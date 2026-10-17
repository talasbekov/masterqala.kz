'use client';
import {useRef,useState} from 'react';
import {AddressEditor,AddressDetails,type AddressFormValue} from './AddressEditor';
import {Button} from './Button';
import {useOwnedAccountResource,type AccountApi} from './hooks/useOwnedAccountResource';
export interface SavedAccountAddress {id:string;label:string;address:string;entrance:string|null;floor:string|null;apartment:string|null;comment:string|null;isDefault:boolean}
interface AddressDraft {editingId:string;form:AddressFormValue;pendingCreate:boolean}
interface DraftStore {load:(owner:string)=>AddressDraft|null;save:(owner:string,draft:AddressDraft)=>boolean;clear:(owner:string)=>void}
const emptyForm:AddressFormValue={label:'',address:'',entrance:'',floor:'',apartment:'',comment:'',isDefault:false};
const formOf=(a:SavedAccountAddress):AddressFormValue=>({label:a.label,address:a.address,entrance:a.entrance??'',floor:a.floor??'',apartment:a.apartment??'',comment:a.comment??'',isDefault:a.isDefault});
export function AccountAddressBook(props:{ownerId:string|null;api:AccountApi;t:(key:string)=>string;onBack:()=>void;draftStore?:DraftStore}){return <AddressContent key={props.ownerId??'signed-out'} {...props}/>;}
function AddressContent({ownerId,api,t,onBack,draftStore}:Parameters<typeof AccountAddressBook>[0]){
 const resource=useOwnedAccountResource<SavedAccountAddress[]>({ownerId,path:'/addresses',api});
 const [restored]=useState(()=>ownerId?draftStore?.load(ownerId):null);
 const [editingId,setEditingId]=useState<string|null>(restored?.editingId??null);
 const [form,setForm]=useState(restored?.form??emptyForm);
 const [pendingCreate,setPendingCreate]=useState(restored?.pendingCreate??false);
 const pendingCreateRef=useRef(pendingCreate);
 const [draftError,setDraftError]=useState(false);
 const [hasDraft,setHasDraft]=useState(!!restored);
 const [createGeneration,setCreateGeneration]=useState(0);
 const addresses=resource.data??[];const activeId=editingId??addresses[0]?.id??'new';
 const selected=addresses.find(a=>a.id===activeId);const value=editingId?form:selected?formOf(selected):emptyForm;
 const missingDraft=!!draftStore&&!!editingId&&activeId!=='new'&&resource.fresh&&!selected;
 const remember=(id:string,next:AddressFormValue,pending=false)=>{
  if(!ownerId||!draftStore)return true;
  const saved=draftStore.save(ownerId,{editingId:id,form:next,pendingCreate:pending});
  setHasDraft(true);setDraftError(!saved);return saved;
 };
 const edit=(id:string)=>{
  if(resource.busy||!resource.fresh||pendingCreateRef.current)return;
  const a=addresses.find(a=>a.id===id),next=a?formOf(a):emptyForm;
  setForm(next);setEditingId(id);remember(id,next);
 };
 if(!ownerId)return null;
 const discardBlocked=resource.busy||!resource.fresh||(pendingCreate&&resource.generation<=createGeneration);
 const discard=()=>{if(discardBlocked)return;draftStore?.clear(ownerId);pendingCreateRef.current=false;setPendingCreate(false);setHasDraft(false);setDraftError(false);setEditingId(null);setForm(emptyForm);};
 const save=()=>{
  if(!value.label||!value.address||resource.busy||!resource.fresh||missingDraft||pendingCreateRef.current)return;
  // Persist before POST: address creation has no idempotency contract.
  // An unknown response must require list reconciliation, never blind resubmission.
  if(draftStore&&activeId==='new'){
   if(!remember(activeId,value,true))return;
   pendingCreateRef.current=true;setPendingCreate(true);setCreateGeneration(resource.generation);
  }
  const body=JSON.stringify({label:value.label,address:value.address,entrance:value.entrance||undefined,floor:value.floor||undefined,apartment:value.apartment||undefined,comment:value.comment||undefined,isDefault:value.isDefault});
  void resource.mutate(activeId==='new'?'/addresses':`/addresses/${encodeURIComponent(activeId)}`,{method:activeId==='new'?'POST':'PATCH',body},updated=>{
   const list=activeId==='new'?[...addresses,updated]:addresses.map(a=>a.id===activeId?updated:a);
   resource.replaceData(updated.isDefault?list.map(a=>({...a,isDefault:a.id===updated.id})):list);setEditingId(updated.id);setForm(formOf(updated));
   draftStore?.clear(ownerId);pendingCreateRef.current=false;setPendingCreate(false);setHasDraft(false);setDraftError(false);
  });
 };
 return <section className="mq-account-address-page"><div className="mq-account-address-heading flex min-w-0 items-center gap-3"><Button variant="secondary" disabled={resource.busy} onClick={()=>{if(editingId)setEditingId(null);else onBack();}}>{t('addresses.back')}</Button><h1>{t('addresses.title')}</h1></div>
  {draftStore&&<p className="mq-account-address-subtitle">{t('addresses.desktopSubtitle')}</p>}
  {resource.loading&&<p role="status">{t('common.loading')}</p>}
  {resource.error&&<div role="alert"><p>{draftStore?t('addresses.requestError'):resource.error}</p><Button data-account-retry variant="secondary" disabled={resource.busy||resource.loading} onClick={()=>void resource.retry()}>{t('common.retry')}</Button></div>}
  {pendingCreate&&!resource.busy&&<div data-address-create-uncertain role="status" className="mq-account-draft-notice"><p>{t('addresses.createUncertain')}</p><Button variant="secondary" disabled={resource.loading} onClick={()=>void resource.retry()}>{t('addresses.refreshSaved')}</Button></div>}
  {draftError&&<p role="status">{t('addresses.draftStorageFailed')}</p>}
  {missingDraft&&<p role="status">{t('addresses.draftMissing')}</p>}
  {draftStore&&hasDraft&&<div className="mq-account-draft-actions"><p>{t(pendingCreate?'addresses.checkBeforeDiscard':'addresses.draftRetained')}</p>{!editingId&&<Button variant="secondary" disabled={resource.busy} onClick={()=>{const saved=draftStore.load(ownerId);if(saved){setEditingId(saved.editingId);setForm(saved.form);}}}>{t('addresses.resumeDraft')}</Button>}<Button variant="secondary" disabled={discardBlocked} onClick={discard}>{t('addresses.discardDraft')}</Button></div>}
  {resource.data&&<div className="mq-account-address-layout" data-editing={!!editingId}><div className="mq-account-address-list">
   {addresses.length===0&&<p data-address-empty>{t('addresses.empty')}</p>}
   {addresses.map(a=><button key={a.id} type="button" disabled={resource.busy||!resource.fresh||pendingCreate} aria-pressed={activeId===a.id} onClick={()=>edit(a.id)} className="rounded-lg bg-fill-soft p-4 text-left text-primary"><strong>{a.label} {a.isDefault&&(draftStore?<span className="mq-address-default-badge">{t('addresses.defaultBadge')}</span>:'?')}</strong><p>{a.address}<AddressDetails entrance={a.entrance} floor={a.floor} apartment={a.apartment} t={t}/></p><span>{t('addresses.change')}</span></button>)}
   <Button variant="secondary" disabled={resource.busy||!resource.fresh||pendingCreate} onClick={()=>edit('new')}>{t('addresses.addNew')}</Button>
  </div><div className="mq-account-address-form-pane" data-editing={!!editingId}>
   <AddressEditor value={value} onChange={next=>{setEditingId(activeId);setForm(next);remember(activeId,next);}} isNew={activeId==='new'} submitting={resource.busy} disabled={resource.loading||!resource.fresh||pendingCreate||missingDraft} pendingAction={resource.action==='DELETE'?'delete':'save'} error="" t={t} onSave={save}
    onDelete={activeId==='new'?undefined:()=>void resource.mutate(`/addresses/${encodeURIComponent(activeId)}`,{method:'DELETE'},()=>{resource.replaceData(addresses.filter(a=>a.id!==activeId));setEditingId(null);setForm(emptyForm);draftStore?.clear(ownerId);setHasDraft(false);})}/>
  </div></div>}
 </section>;
}
