'use client';
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useLocale} from '../Locale';
import {disputeText} from '../dispute-copy';
import {DisputeContextUnavailable, parseDisputeContext, parseDisputeEvidence, parseOrderDispute, withinDisputeWindow, type DisputeContext, type DisputeEvidence, type DisputeTarget} from '../disputes';
type Api = (path: string, options?: RequestInit) => Promise<unknown>;
type Upload = (path: string, body: FormData, options?: {signal?: AbortSignal}) => Promise<unknown>;
type Action = 'submit' | 'reply' | 'upload';
type Category = 'quality' | 'price' | 'behavior' | 'other';
interface ReadState {contextUnavailable:boolean;context: DisputeContext | null; evidence: DisputeEvidence[]; contextError: string; evidenceError: string; contextLoading: boolean; evidenceLoading: boolean; contextFresh: boolean; evidenceFresh: boolean}
const empty = (): ReadState => ({contextUnavailable:false,context:null,evidence:[],contextError:'',evidenceError:'',contextLoading:false,evidenceLoading:false,contextFresh:false,evidenceFresh:false});
const prefixes = {ru:{quality:'Качество',price:'Цена',behavior:'Поведение',other:'Другое'},kk:{quality:'Сапа',price:'Баға',behavior:'Мінез-құлық',other:'Басқа'},en:{quality:'Quality',price:'Price',behavior:'Behavior',other:'Other'}};
/** Existing dispute contracts only. Drafts/files never leave current component memory except explicit writes. */
export function useOrderDispute({ownerId,target,expectedDisputeId,api,upload}:{ownerId:string|null;target:DisputeTarget;expectedDisputeId?:string;api:Api;upload:Upload}) {
  const {language} = useLocale();
  const scope = useMemo(() => ({ownerId,kind:target.kind,id:target.id,expectedDisputeId,api,upload}), [ownerId,target.kind,target.id,expectedDisputeId,api,upload]);
  const current = useRef(scope), mounted = useRef(false), read = useRef(0), draft = useRef(0), editEpoch = useRef(0), lock = useRef(false), reading = useRef(false), abort = useRef<AbortController|null>(null);
  const currentState = useRef(empty()), needsRead = useRef<Action|null>(null), languageRef = useRef(language);
  const values = useRef({reason:'',statement:'',category:'quality' as Category});
  const [stored,setStored] = useState(() => ({scope,...empty()}));
  const [reason,setReason] = useState(''), [statement,setStatement] = useState(''), [category,setCategory] = useState<Category>('quality'), [file,setFile] = useState<File|null>(null);
  const [busy,setBusy] = useState<Action|null>(null), [writeError,setWriteError] = useState('');
  const [online,setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const onlineNow=useRef(online);
  const state = stored.scope === scope ? stored : empty();
  const capturedRead = read.current, capturedDraft = draft.current, capturedEditor = editEpoch.current;
  const owned = () => !!ownerId && mounted.current && current.current === scope;
  function update(patch: Partial<ReadState>) {
    if (!owned()) return;
    currentState.current = {...currentState.current,...patch};
    setStored({scope,...currentState.current});
  }
  useLayoutEffect(() => {
    current.current = scope; mounted.current = true; read.current++; draft.current++; editEpoch.current++; lock.current = false; reading.current = false; abort.current?.abort(); abort.current = null; needsRead.current = null;
    currentState.current = empty(); values.current = {reason:'',statement:'',category:'quality'};
    setStored({scope,...empty()}); setReason(''); setStatement(''); setCategory('quality'); setFile(null); setBusy(null); setWriteError('');
    return () => {mounted.current = false; read.current++; draft.current++; abort.current?.abort(); values.current = {reason:'',statement:'',category:'quality'};};
  },[scope]);
  useLayoutEffect(() => {languageRef.current = language;},[language]);
  useEffect(() => {
    const on = () => {onlineNow.current=true;setOnline(true);}, off = () => {onlineNow.current=false;setOnline(false);};
    window.addEventListener('online',on); window.addEventListener('offline',off);
    return () => {window.removeEventListener('online',on); window.removeEventListener('offline',off);};
  },[]);
  const retry = useCallback(async () => {
    if (!ownerId || !mounted.current || current.current !== scope || lock.current || reading.current) return;
    reading.current = true;
    const revision = ++read.current;
    const valid = () => mounted.current && current.current === scope && read.current === revision;
    update({contextLoading:true,contextFresh:false,evidenceFresh:false,contextError:'',evidenceError:'',contextUnavailable:false});
    try {
      const context = parseDisputeContext(await api('/'+scope.kind+'/'+encodeURIComponent(scope.id)), scope, expectedDisputeId);
      if (!valid()) return;
      const evidence=currentState.current.context?.dispute?.id===context.dispute?.id?currentState.current.evidence:[];
      update({context,evidence,contextLoading:false,contextFresh:true,evidenceLoading:!!context.dispute});
      if (context.dispute) {
        try {
          const evidence = parseDisputeEvidence(await api('/disputes/'+encodeURIComponent(context.dispute.id)+'/evidence'));
          if (!valid()) return;
          update({evidence,evidenceLoading:false,evidenceFresh:true});
        } catch(cause) {
          if (!valid()) return;
          update({evidenceLoading:false,evidenceFresh:false,evidenceError:cause instanceof Error?cause.message:'Evidence unavailable'});
        }
      } else update({evidence:[],evidenceLoading:false,evidenceFresh:true});
      if (valid() && (needsRead.current !== 'upload' || currentState.current.evidenceFresh)) {needsRead.current = null;setWriteError('');}
    } catch(cause) {
      if (valid()) update({contextLoading:false,evidenceLoading:false,contextFresh:false,contextUnavailable:cause instanceof DisputeContextUnavailable,contextError:cause instanceof Error?cause.message:'Order unavailable'});
    } finally {if (valid()) {reading.current = false;setStored({scope,...currentState.current});}}
  },[scope,ownerId,api,expectedDisputeId]);
  useEffect(() => {void retry();},[retry]);
  const participant = (context:DisputeContext|null) => !!ownerId && !!context && (context.clientId === ownerId || context.masterId === ownerId);
  const connected = () => onlineNow.current && (typeof navigator === 'undefined' || navigator.onLine !== false);
  const verified = () => owned() && read.current === capturedRead && currentState.current.contextFresh && !needsRead.current && !reading.current && !lock.current && connected();
  const draftCurrent = () => draft.current === capturedDraft;
  const validReason = () => {const value=(prefixes[languageRef.current][values.current.category]+'. '+values.current.reason.trim()).trim();return values.current.reason.trim() && value.length<=2000 ? value : null;};
  const canSubmit = state.contextFresh && !needsRead.current && !reading.current && !busy && online && participant(state.context) && !state.context?.dispute && !!state.context && withinDisputeWindow(state.context) && !!validReason();
  const canReply = state.contextFresh && !needsRead.current && !reading.current && !busy && online && participant(state.context) && state.context?.dispute?.status === 'OPEN' && !!state.context.dispute.openedByUserId && state.context.dispute.openedByUserId !== ownerId && !state.context.dispute.counterStatement && !!statement.trim() && statement.trim().length<=2000;
  const canUpload = state.contextFresh && state.evidenceFresh && !needsRead.current && !reading.current && !busy && online && participant(state.context) && state.context?.dispute?.status === 'OPEN';
  function changeReason(value:string) {if (!owned() || lock.current || editEpoch.current !== capturedEditor) return;values.current.reason=value;draft.current++;setReason(value);setWriteError('');}
  function changeStatement(value:string) {if (!owned() || lock.current || editEpoch.current !== capturedEditor) return;values.current.statement=value;draft.current++;setStatement(value);setWriteError('');}
  function changeCategory(value:Category) {if (!owned() || lock.current || editEpoch.current !== capturedEditor || !Object.hasOwn(prefixes.en,value)) return;values.current.category=value;draft.current++;setCategory(value);setWriteError('');}
  function cancel() {if (!owned() || lock.current || !draftCurrent()) return;draft.current++;editEpoch.current++;values.current={reason:'',statement:'',category:'quality'};setReason('');setStatement('');setCategory('quality');setFile(null);setWriteError('');}
  async function write(action:Action, selected?:File, confirm?:()=>boolean) {
    if (!verified() || !draftCurrent()) return;
    const context=currentState.current.context;
    if (!participant(context) || !context) return;
    if (action==='submit' && (context.dispute || !withinDisputeWindow(context) || !validReason())) return;
    if (action==='reply' && (context.dispute?.status!=='OPEN' || !context.dispute.openedByUserId || context.dispute.openedByUserId===ownerId || context.dispute.counterStatement || !values.current.statement.trim() || values.current.statement.trim().length>2000 || !confirm?.())) return;
    if (action==='upload' && (context.dispute?.status!=='OPEN' || !currentState.current.evidenceFresh || !selected)) return;
    if (action==='upload' && selected && (!['image/jpeg','image/png'].includes(selected.type) || selected.size>10*1024*1024)) {setWriteError(disputeText(languageRef.current,'fileInvalid'));return;}
    // Confirmation can run arbitrary navigation; recheck ownership/read/draft after it returns.
    if (!verified() || !draftCurrent()) return;
    const controller=new AbortController(), revision=read.current;
    abort.current=controller;lock.current=true;setBusy(action);setWriteError('');
    if (selected) setFile(selected);
    const valid=()=>owned() && read.current===revision && !controller.signal.aborted;
    try {
      if (action==='upload') {
        const body=new FormData();body.append('file',selected!);
        const acknowledgment=await upload('/disputes/'+encodeURIComponent(context.dispute!.id)+'/evidence',body,{signal:controller.signal});
        if (!valid()) return;
        if (!acknowledgment || typeof acknowledgment!=='object' || !('scanStatus' in acknowledgment) || acknowledgment.scanStatus!=='CLEAN' || !((('id' in acknowledgment && typeof acknowledgment.id==='string' && acknowledgment.id.trim()) || ('evidenceId' in acknowledgment && typeof acknowledgment.evidenceId==='string' && acknowledgment.evidenceId.trim())))) throw new Error(disputeText(languageRef.current,'unknown'));
        const evidence=parseDisputeEvidence(await api('/disputes/'+encodeURIComponent(context.dispute!.id)+'/evidence',{signal:controller.signal}));
        if (!valid()) return;
        update({evidence,evidenceFresh:true});setFile(null);
      } else {
        const result=parseOrderDispute(await api(action==='submit'?'/'+scope.kind+'/'+encodeURIComponent(scope.id)+'/disputes':'/disputes/'+encodeURIComponent(context.dispute!.id),{method:action==='submit'?'POST':'PATCH',body:JSON.stringify(action==='submit'?{reason:validReason()}:{counterStatement:values.current.statement.trim()}),signal:controller.signal}),scope);
        if (!valid()) return;
        if (action==='reply' && result.id!==context.dispute!.id) throw new Error('Unexpected dispute response');
        update({context:{...context,dispute:result}});
        draft.current++;
        if (action==='submit') {
          const evidence=parseDisputeEvidence(await api('/disputes/'+encodeURIComponent(result.id)+'/evidence',{signal:controller.signal}));
          if (valid()) update({evidence,evidenceFresh:true});
        }
      }
    } catch(cause) {
      if (valid() && !(cause instanceof Error && cause.name==='AbortError')) {
        needsRead.current=action;
        update({contextFresh:false,evidenceFresh:false});
        setWriteError(cause instanceof Error?cause.message:'Dispute write outcome unavailable');
      }
    } finally {
      if (owned() && abort.current===controller) {lock.current=false;abort.current=null;setBusy(null);}
    }
  }
  return {...state,ownerId,needsReconciliation:stored.scope===scope&&!!needsRead.current,reason:stored.scope===scope?reason:'',statement:stored.scope===scope?statement:'',category:stored.scope===scope?category:'quality',file:stored.scope===scope?file:null,busy:stored.scope===scope?busy:null,writeError:stored.scope===scope?writeError:'',online,canSubmit,canReply,canUpload,retry,changeReason,changeStatement,changeCategory,cancel,submit:()=>write('submit'),reply:(confirm:()=>boolean)=>write('reply',undefined,confirm),uploadFile:(selected:File)=>write('upload',selected)};
}
