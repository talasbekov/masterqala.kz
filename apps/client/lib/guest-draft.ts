import {getDraftStorage,emptyNewOrderDraft,writeNewOrderDraft,DRAFT_STORAGE_KEY,CREATE_PENDING_KEY,type NewOrderDraft} from './new-order-draft';
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export const GUEST_DRAFT_KEY='mq.desktop.guest-draft.v1';
function sanitize(value:unknown):NewOrderDraft|null {
 if(!value||typeof value!=='object')return null;
 const d=value as NewOrderDraft, result=emptyNewOrderDraft();
 const limits={categoryId:100,description:2000,addressText:500,district:200,entrance:50,floor:50,apartment:50,addressComment:500};
 for(const key of Object.keys(limits) as (keyof typeof limits)[]){if(typeof d[key]!=='string'||d[key].length>limits[key])return null;result[key]=d[key];}
 if(!d.geo||!Number.isFinite(d.geo.lat)||!Number.isFinite(d.geo.lng)||Math.abs(d.geo.lat)>90||Math.abs(d.geo.lng)>180||!Array.isArray(d.photoPaths)||d.photoPaths.length)return null;
 result.geo={lat:d.geo.lat,lng:d.geo.lng};result.locationChosen=d.locationChosen===true;return result;
}
export function saveGuestDraft(draft:NewOrderDraft,storage:Store|undefined=getDraftStorage()):boolean{
 const clean=sanitize(draft);if(!clean||!storage)return false;
 try{storage.setItem(GUEST_DRAFT_KEY,JSON.stringify({draft:clean,continueAfterLogin:false}));return true;}catch{return false;}
}
export function readGuestDraft(storage:Store|undefined=getDraftStorage()):NewOrderDraft|null{
 try{const raw=storage?.getItem(GUEST_DRAFT_KEY);if(!raw)return null;const d=sanitize(JSON.parse(raw).draft);if(!d)clearGuestDraft(storage);return d;}catch{clearGuestDraft(storage);return null;}
}
export function prepareGuestContinuation(storage:Store|undefined=getDraftStorage()):boolean{
 const draft=readGuestDraft(storage);if(!draft||!storage)return false;
 try{storage.setItem(GUEST_DRAFT_KEY,JSON.stringify({draft,continueAfterLogin:true}));return true;}catch{return false;}
}
/** Navigation may only continue with the exact current in-memory fields. */
export function startGuestContinuation(draft:NewOrderDraft,storage:Store|undefined=getDraftStorage()):boolean{
 return saveGuestDraft(draft,storage)&&prepareGuestContinuation(storage);
}
export function claimGuestDraft(ownerId:string,storage:Store|undefined=getDraftStorage()):'none'|'claimed'|'conflict'|'unavailable'{
 if(!ownerId||!storage)return 'none';
 try{
  const raw=storage.getItem(GUEST_DRAFT_KEY);if(!raw||JSON.parse(raw).continueAfterLogin!==true)return 'none';
  const draft=readGuestDraft(storage);if(!draft)return 'none';
  if(storage.getItem(DRAFT_STORAGE_KEY)||storage.getItem(CREATE_PENDING_KEY)){clearGuestDraft(storage);return 'conflict';}
  if(!writeNewOrderDraft(ownerId,draft,storage))return 'unavailable';
  clearGuestDraft(storage);return 'claimed';
 }catch{return 'unavailable';}
}
export function clearGuestDraft(storage:Store|undefined=getDraftStorage()):void{try{storage?.removeItem(GUEST_DRAFT_KEY);}catch{/* Optional tab storage. */}}
