export const URGENT_QUOTE_DRAFT_PREFIX='mq:master:urgent-quote:v1:';
export interface UrgentQuoteDraft {price:string;comment:string}
export const emptyUrgentQuoteDraft=():UrgentQuoteDraft=>({price:'',comment:''});
function key(ownerId:string,id:string){return `${URGENT_QUOTE_DRAFT_PREFIX}${encodeURIComponent(ownerId)}:${encodeURIComponent(id)}`;}
/** sessionStorage is isolated to this browser tab; neither order reads nor locale changes replace edits. */
export function readUrgentQuoteDraft(ownerId:string,id:string):{draft:UrgentQuoteDraft;available:boolean} {
 try {
  const raw=window.sessionStorage.getItem(key(ownerId,id));
  if(!raw)return {draft:emptyUrgentQuoteDraft(),available:true};
  const value=JSON.parse(raw);
  if(value?.version!==1||typeof value.price!=='string'||value.price.length>64||typeof value.comment!=='string'||value.comment.length>1000)return {draft:emptyUrgentQuoteDraft(),available:true};
  return {draft:{price:value.price,comment:value.comment},available:true};
 }catch{return {draft:emptyUrgentQuoteDraft(),available:false};}
}
export function saveUrgentQuoteDraft(ownerId:string,id:string,draft:UrgentQuoteDraft):boolean {
 try{window.sessionStorage.setItem(key(ownerId,id),JSON.stringify({version:1,...draft}));return true;}catch{return false;}
}
export function clearUrgentQuoteDraft(ownerId:string,id:string):boolean {
 try{window.sessionStorage.removeItem(key(ownerId,id));return true;}catch{return false;}
}
/** Logout integration: omit ownerId to remove all urgent quote drafts in the current tab only. */
export function clearUrgentQuoteDrafts(ownerId?:string):boolean {
 try {
  const prefix=ownerId===undefined?URGENT_QUOTE_DRAFT_PREFIX:`${URGENT_QUOTE_DRAFT_PREFIX}${encodeURIComponent(ownerId)}:`;
  const storage=window.sessionStorage;
  for(let index=storage.length-1;index>=0;index--){const current=storage.key(index);if(current?.startsWith(prefix))storage.removeItem(current);}
  return true;
 }catch{return false;}
}
