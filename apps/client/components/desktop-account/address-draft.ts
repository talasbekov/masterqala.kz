import type {AddressFormValue} from '@masterqala/ui';
export const ADDRESS_DRAFT_KEY='mq.desktop.address-draft.v1';
export const PROFILE_DRAFT_KEY='mq.desktop.profile-draft.v1';
type StoragePort=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type AddressDraft={editingId:string;form:AddressFormValue;pendingCreate:boolean};
type ProfileDraft={name:string};
function storage():StoragePort|null {try{return typeof window==='undefined'?null:window.sessionStorage;}catch{return null;}}
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.length<=20000;
const validAddress=(value:unknown):value is AddressDraft=>record(value)&&text(value.editingId)&&!!value.editingId&&typeof value.pendingCreate==='boolean'&&record(value.form)&&['label','address','entrance','floor','apartment','comment'].every(key=>text((value.form as Record<string,unknown>)[key]))&&typeof value.form.isDefault==='boolean';
const validProfile=(value:unknown):value is ProfileDraft=>record(value)&&text(value.name);
function store<T>(key:string,valid:(value:unknown)=>value is T,getStorage:()=>StoragePort|null=storage){
 return {
  load(ownerId:string):T|null {try {const target=getStorage(),raw=target?.getItem(key);if(!raw)return null;const saved:unknown=JSON.parse(raw);if(!record(saved)||saved.version!==1||saved.ownerId!==ownerId||!valid(saved.value)){target?.removeItem(key);return null;}return saved.value;}catch{return null;}},
  save(ownerId:string,value:T):boolean {try{const target=getStorage();if(!target||!ownerId||!valid(value))return false;target.setItem(key,JSON.stringify({version:1,ownerId,value}));return true;}catch{return false;}},
  clear(ownerId?:string):void {try{const target=getStorage();if(!target)return;if(ownerId){const raw=target.getItem(key);if(raw&&JSON.parse(raw).ownerId!==ownerId)return;}target.removeItem(key);}catch{/* Storage may be unavailable. */}},
 };
}
export const createDesktopAddressDraftStore=(getStorage:()=>StoragePort|null)=>store(ADDRESS_DRAFT_KEY,validAddress,getStorage);
export const createDesktopProfileDraftStore=(getStorage:()=>StoragePort|null)=>store(PROFILE_DRAFT_KEY,validProfile,getStorage);
export const desktopAddressDraftStore=store(ADDRESS_DRAFT_KEY,validAddress);
export const desktopProfileDraftStore=store(PROFILE_DRAFT_KEY,validProfile);
export function clearDesktopAccountDrafts(){desktopAddressDraftStore.clear();desktopProfileDraftStore.clear();}
