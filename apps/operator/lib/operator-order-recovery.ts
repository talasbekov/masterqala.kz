import type {OrderSelection} from './operator-order-reads';
const prefix=(ownerId:string)=>`mq:operator:assignment:${encodeURIComponent(ownerId)}:`;
const storageKey=(ownerId:string,target:OrderSelection)=>`${prefix(ownerId)}${encodeURIComponent(target.id)}`;
/** Only opaque IDs are stored, in this tab and for this owner. No order/customer payloads. */
export function readAssignmentRecovery(ownerId:string):{target:OrderSelection;rejected:boolean}[]{
 const storage=window.sessionStorage,targets:{target:OrderSelection;rejected:boolean}[]=[];
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i);if(!key?.startsWith(prefix(ownerId)))continue;
  // The key itself is the lock; damaged marker contents must not unlock an action.
  try{const id=decodeURIComponent(key.slice(prefix(ownerId).length));if(id.trim())targets.push({target:{id,type:'urgent'},rejected:storage.getItem(key)==='rejected'});}catch{/* unrelated malformed key */}
 }
 return targets;
}
export function saveAssignmentRecovery(ownerId:string,target:OrderSelection,rejected=false){window.sessionStorage.setItem(storageKey(ownerId,target),rejected?'rejected':'1');}
export function clearAssignmentRecovery(ownerId:string,target:OrderSelection){window.sessionStorage.removeItem(storageKey(ownerId,target));}
