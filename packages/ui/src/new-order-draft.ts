export const DRAFT_STORAGE_KEY = 'mq.new-order.draft.v1';
export const DRAFT_CLEARED_EVENT = 'mq:new-order-draft-cleared';
export interface NewOrderDraft {
  step: 1 | 2 | 3 | 4;
  categoryId: string; description: string; photoPaths: string[];
  geo: {lat:number;lng:number}; addressText: string; district: string;
  entrance: string; floor: string; apartment: string; addressComment: string;
  locationChosen: boolean;
  /** Saved addresses without coordinates require an explicit pin decision. */
  locationNeedsConfirmation?: boolean;
}
export function emptyNewOrderDraft(): NewOrderDraft {
  return {step:1,categoryId:'',description:'',photoPaths:[],geo:{lat:51.1605,lng:71.4704},addressText:'',district:'',entrance:'',floor:'',apartment:'',addressComment:'',locationChosen:false};
}
export function getDraftStorage(): Storage | undefined {
  try {return typeof window==='undefined'?undefined:window.sessionStorage;}catch{return undefined;}
}
const textFields = ['categoryId','description','addressText','district','entrance','floor','apartment','addressComment'] as const;
/** Restore incomplete editable values, not server approval, prices or authentication state. */
function submittedFields(value:unknown):NewOrderDraft|null {
  if(!value||typeof value!=='object')return null;
  const draft=value as NewOrderDraft;
  if(![1,2,3,4].includes(draft.step)||typeof draft.locationChosen!=='boolean'||textFields.some(key=>typeof draft[key]!=='string'))return null;
  if(!draft.geo||!Number.isFinite(draft.geo.lat)||!Number.isFinite(draft.geo.lng)||Math.abs(draft.geo.lat)>90||Math.abs(draft.geo.lng)>180)return null;
  if(!Array.isArray(draft.photoPaths)||draft.photoPaths.length>5||draft.photoPaths.some(path=>typeof path!=='string'||!path||/^(blob:|data:)/i.test(path)))return null;
  if(draft.locationNeedsConfirmation!==undefined&&typeof draft.locationNeedsConfirmation!=='boolean')return null;
  return {step:draft.step,categoryId:draft.categoryId,description:draft.description,photoPaths:[...draft.photoPaths],geo:{lat:draft.geo.lat,lng:draft.geo.lng},addressText:draft.addressText,district:draft.district,entrance:draft.entrance,floor:draft.floor,apartment:draft.apartment,addressComment:draft.addressComment,locationChosen:draft.locationChosen,...(draft.locationNeedsConfirmation!==undefined?{locationNeedsConfirmation:draft.locationNeedsConfirmation}:{})};
}
function remove(storage?:Pick<Storage,'removeItem'>){try{storage?.removeItem(DRAFT_STORAGE_KEY);}catch{/* Storage is optional. */}}
export function readNewOrderDraft(ownerId:string,storage:Pick<Storage,'getItem'|'removeItem'>|undefined=getDraftStorage()):NewOrderDraft|null {
  try {
    const raw=storage?.getItem(DRAFT_STORAGE_KEY);if(!raw)return null;
    const record=JSON.parse(raw);
    const draft=record.schemaVersion===1&&record.ownerId===ownerId&&ownerId?submittedFields(record.draft):null;
    if(!draft)remove(storage);
    return draft;
  }catch{remove(storage);return null;}
}
export function writeNewOrderDraft(ownerId:string,value:unknown,storage:Pick<Storage,'setItem'>|undefined=getDraftStorage()):boolean {
  const draft=submittedFields(value);if(!ownerId||!draft||!storage)return false;
  try{storage.setItem(DRAFT_STORAGE_KEY,JSON.stringify({schemaVersion:1,ownerId,draft}));return true;}catch{return false;}
}
/** Explicit logout clears only this tab's draft and invalidates pending writers. */
export function clearNewOrderDraft(storage:Pick<Storage,'removeItem'>|undefined=getDraftStorage()):void {
  remove(storage);
  setVolatilePending(null);
  try{storage?.removeItem(CREATE_PENDING_KEY);}catch{/* Optional storage. */}
  if(typeof window!=='undefined')window.dispatchEvent(new window.Event(DRAFT_CLEARED_EVENT));
}
export function createDraftSession(ownerId:string,storage=getDraftStorage()) {
  const restored=readNewOrderDraft(ownerId,storage);
  let snapshot=restored??emptyNewOrderDraft();
  let active=true;
  let editable=true;
  let locationRevision=0;
  const listeners=new Set<()=>void>();
  function publish(next:NewOrderDraft) {
    if(!active||!editable)return;
    snapshot=next;
    writeNewOrderDraft(ownerId,snapshot,storage);
    listeners.forEach(listener=>listener());
  }
  return {
    getSnapshot:()=>snapshot,
    isActive:()=>active,
    freeze(){editable=false;},
    subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
    set<K extends keyof NewOrderDraft>(key:K,value:NewOrderDraft[K]|((previous:NewOrderDraft[K])=>NewOrderDraft[K])) {
      if(!active||!editable)return;
      if(key==='geo'||key==='addressText')locationRevision++;
      const next=typeof value==='function'?value(snapshot[key]):value;
      publish({...snapshot,[key]:next,locationChosen:key==='geo'||(!snapshot.locationNeedsConfirmation&&(snapshot.locationChosen||key==='addressText')),...(key==='geo'&&snapshot.locationNeedsConfirmation?{locationNeedsConfirmation:false}:{})});
    },
    patch(fields:Partial<NewOrderDraft>) {
      if(!active||!editable)return;
      if('geo' in fields||'addressText' in fields)locationRevision++;
      publish({...snapshot,...fields});
    },
    requestLocation(){
      const revision=++locationRevision;
      return (geo:NewOrderDraft['geo'])=>{if(active&&editable&&revision===locationRevision)publish({...snapshot,geo,locationChosen:true,...(snapshot.locationNeedsConfirmation?{locationNeedsConfirmation:false}:{})});};
    },
    applyInitialLocation(geo:NewOrderDraft['geo']) {
      if(!active||restored||snapshot.locationChosen||snapshot.locationNeedsConfirmation)return;
      publish({...snapshot,geo});
    },
    complete(){if(!active)return false;active=false;clearNewOrderDraft(storage);listeners.clear();return true;},
    dispose(){active=false;listeners.clear();},
  };
}
export const CREATE_PENDING_KEY='mq.new-order.pending.v1';
export const DRAFT_CREATED_EVENT='mq:new-order-created';
export interface CurrentOrderSubmission {
 categoryId:string;description:string;address:string;district:string;lat:number;lng:number;photoPaths:string[];
 entrance?:string;floor?:string;apartment?:string;addressComment?:string;
}
export interface PendingCreate {ownerId:string;requestId:string;persistent:boolean;protocol:'LOCAL_ONLY'|'SERVER_KEYED';submitted?:CurrentOrderSubmission;}
const storedPhoto=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/i;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Only the submitted API fields are durable; prices, auth and previews never are. */
function submission(value:unknown):CurrentOrderSubmission|null {
 if(!value||typeof value!=='object')return null;
 const p=value as CurrentOrderSubmission;
 if(!uuid.test(p.categoryId)||typeof p.description!=='string'||!p.description||p.description.length>2000||typeof p.address!=='string'||!p.address||p.address.length>500||typeof p.district!=='string'||!p.district||p.district.length>200)return null;
 if(!Number.isFinite(p.lat)||Math.abs(p.lat)>90||!Number.isFinite(p.lng)||Math.abs(p.lng)>180)return null;
 if(!Array.isArray(p.photoPaths)||p.photoPaths.length>5||new Set(p.photoPaths).size!==p.photoPaths.length||p.photoPaths.some(path=>typeof path!=='string'||!storedPhoto.test(path)))return null;
 const result:CurrentOrderSubmission={categoryId:p.categoryId,description:p.description,address:p.address,district:p.district,lat:p.lat,lng:p.lng,photoPaths:[...p.photoPaths]};
 for(const key of ['entrance','floor','apartment','addressComment'] as const){const v=p[key];if(v!==undefined){if(typeof v!=='string'||v.length>(key==='addressComment'?500:50))return null;result[key]=v;}}
 return result;
}
export function currentOrderSubmission(draft:NewOrderDraft):CurrentOrderSubmission|null {
 if(draft.locationNeedsConfirmation)return null;
 return submission({categoryId:draft.categoryId,description:draft.description,address:draft.addressText,district:draft.district,lat:draft.geo.lat,lng:draft.geo.lng,photoPaths:draft.photoPaths,entrance:draft.entrance||undefined,floor:draft.floor||undefined,apartment:draft.apartment||undefined,addressComment:draft.addressComment||undefined});
}
// One browser-window record survives same-document route remounts, never SSR requests.
const volatilePendingKey=Symbol.for('mq.new-order.pending');
function volatilePending():PendingCreate|null {
  return typeof window==='undefined'?null:(window as Window&{[volatilePendingKey]?:PendingCreate})[volatilePendingKey]??null;
}
function setVolatilePending(value:PendingCreate|null) {
  if(typeof window==='undefined')return;
  const scope=window as Window&{[volatilePendingKey]?:PendingCreate};
  if(value)scope[volatilePendingKey]=value;else delete scope[volatilePendingKey];
}
export function readPendingCreate(ownerId:string,storage=getDraftStorage()):PendingCreate|null {
  try {
    const raw=storage?.getItem(CREATE_PENDING_KEY);
    if(raw){
      const record=JSON.parse(raw);
      if([1,2].includes(record.schemaVersion)&&record.ownerId===ownerId&&ownerId){
        // Recognizable damaged markers still represent an unknown outcome, never a new intent.
        const keyValid=typeof record.requestId==='string'&&record.requestId.length>0&&record.requestId.length<=100;
        if(!keyValid)return {ownerId,requestId:'',persistent:true,protocol:'LOCAL_ONLY'};
        const submitted=record.schemaVersion===2&&record.protocol==='SERVER_KEYED'&&uuid.test(record.requestId)?submission(record.submitted):null;
        return submitted?{ownerId,requestId:record.requestId,persistent:true,protocol:'SERVER_KEYED',submitted}:{ownerId,requestId:record.requestId,persistent:true,protocol:'LOCAL_ONLY'};
      }
      storage?.removeItem(CREATE_PENDING_KEY);
    }
  }catch{try{storage?.removeItem(CREATE_PENDING_KEY);}catch{/* Optional storage. */}}
  const pending=volatilePending();
  if(pending?.ownerId===ownerId&&ownerId)return pending;
  if(pending)setVolatilePending(null);
  return null;
}
export function beginPendingCreate(ownerId:string,storage=getDraftStorage(),value?:CurrentOrderSubmission):PendingCreate|null {
  if(!ownerId||readPendingCreate(ownerId,storage))return null;
  const submitted=value===undefined?undefined:submission(value);if(value!==undefined&&!submitted)return null;
  const request:PendingCreate={ownerId,requestId:globalThis.crypto.randomUUID(),persistent:false,protocol:submitted?'SERVER_KEYED':'LOCAL_ONLY',...(submitted?{submitted}:{})};
  try{if(storage){storage.setItem(CREATE_PENDING_KEY,JSON.stringify({schemaVersion:2,ownerId,requestId:request.requestId,protocol:request.protocol,submitted:request.submitted}));request.persistent=true;}}catch{/* Same-document fallback only; reload recovery cannot be promised. */}
  if(!request.persistent)setVolatilePending(request);
  return request;
}
export function canRecoverCreate(request:PendingCreate|null):boolean {
 return !!request&&request.protocol==='SERVER_KEYED'&&uuid.test(request.requestId)&&!!submission(request.submitted);
}
/** Read-only ownership check: an old action must not erase a different account's marker. */
export function ownsPendingCreate(request:PendingCreate,storage=getDraftStorage()):boolean {
 let stored:PendingCreate|null=null;
 try{const raw=storage?.getItem(CREATE_PENDING_KEY);stored=raw?JSON.parse(raw):null;}catch{/* Optional storage. */}
 const memory=volatilePending();
 return [stored,memory].some(p=>p?.ownerId===request.ownerId&&p?.requestId===request.requestId);
}
export async function sendCurrentOrder(request:PendingCreate,api:(path:string,options:{method:string;body:string})=>Promise<{id:string;creationProcessing?:boolean}>) {
 if(!canRecoverCreate(request))throw new Error('Submission is not recoverable with a server key');
 // Both the initial attempt and deliberate recovery share the original submitted snapshot.
 const order=await api('/orders/idempotent',{method:'POST',body:JSON.stringify({...submission(request.submitted),clientRequestId:request.requestId})});
 if(typeof order?.id!=='string'||!order.id)throw new Error('The server did not confirm an order identity');
 return order;
}
/** A confirmed response resolves only its exact local marker. Similar orders are not evidence. */
export function resolvePendingCreate(request:PendingCreate,orderId:string,storage=getDraftStorage()):boolean {
  if(!orderId)return false;
  let stored:PendingCreate|null=null;
  try{const raw=storage?.getItem(CREATE_PENDING_KEY);stored=raw?JSON.parse(raw):null;}catch{/* The memory fallback remains available. */}
  const memory=volatilePending();
  const matchingStored=stored?.ownerId===request.ownerId&&stored?.requestId===request.requestId;
  const matchingMemory=memory?.ownerId===request.ownerId&&memory?.requestId===request.requestId;
  if(!matchingStored&&!matchingMemory)return false;
  try {
    // No other account or newer request is cleared by an old response.
    const raw=storage?.getItem(DRAFT_STORAGE_KEY);
    if(raw&&JSON.parse(raw).ownerId===request.ownerId)remove(storage);
    if(matchingStored)storage?.removeItem(CREATE_PENDING_KEY);
  }catch{if(matchingStored)return false;}
  if(matchingMemory)setVolatilePending(null);
  if(typeof window!=='undefined')window.dispatchEvent(new window.CustomEvent(DRAFT_CREATED_EVENT,{detail:{...request,orderId}}));
  return true;
}
