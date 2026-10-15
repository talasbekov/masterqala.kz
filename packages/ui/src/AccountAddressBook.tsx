'use client';
import {useState} from 'react';
import {AddressEditor,AddressDetails,type AddressFormValue} from './AddressEditor';
import {Button} from './Button';
import {useOwnedAccountResource,type AccountApi} from './hooks/useOwnedAccountResource';
export interface SavedAccountAddress {id:string;label:string;address:string;entrance:string|null;floor:string|null;apartment:string|null;comment:string|null;isDefault:boolean}
const emptyForm:AddressFormValue={label:'',address:'',entrance:'',floor:'',apartment:'',comment:'',isDefault:false};
const formOf=(a:SavedAccountAddress):AddressFormValue=>({label:a.label,address:a.address,entrance:a.entrance??'',floor:a.floor??'',apartment:a.apartment??'',comment:a.comment??'',isDefault:a.isDefault});
export function AccountAddressBook(props:{ownerId:string|null;api:AccountApi;t:(key:string)=>string;onBack:()=>void}){return <AddressContent key={props.ownerId??'signed-out'} {...props}/>;}
function AddressContent({ownerId,api,t,onBack}:Parameters<typeof AccountAddressBook>[0]){
 const resource=useOwnedAccountResource<SavedAccountAddress[]>({ownerId,path:'/addresses',api});
 const [editingId,setEditingId]=useState<string|null>(null);const [form,setForm]=useState(emptyForm);
 const addresses=resource.data??[];const activeId=editingId??addresses[0]?.id??'new';
 const selected=addresses.find(a=>a.id===activeId);const value=editingId?form:selected?formOf(selected):emptyForm;
 const edit=(id:string)=>{if(resource.busy||!resource.fresh)return;const a=addresses.find(a=>a.id===id);setForm(a?formOf(a):emptyForm);setEditingId(id);};
 if(!ownerId)return null;
 const save=()=>{
  if(!value.label||!value.address)return;
  const body=JSON.stringify({label:value.label,address:value.address,entrance:value.entrance||undefined,floor:value.floor||undefined,apartment:value.apartment||undefined,comment:value.comment||undefined,isDefault:value.isDefault});
  void resource.mutate(activeId==='new'?'/addresses':`/addresses/${encodeURIComponent(activeId)}`,{method:activeId==='new'?'POST':'PATCH',body},updated=>{
   const list=activeId==='new'?[...addresses,updated]:addresses.map(a=>a.id===activeId?updated:a);
   resource.replaceData(updated.isDefault?list.map(a=>({...a,isDefault:a.id===updated.id})):list);setEditingId(updated.id);setForm(formOf(updated));
  });
 };
 return <section className="mq-account-address-page"><div className="flex min-w-0 items-center gap-3"><Button variant="secondary" disabled={resource.busy} onClick={()=>{if(editingId)setEditingId(null);else onBack();}}>{t('addresses.back')}</Button><h1>{t('addresses.title')}</h1></div>
  {resource.loading&&<p role="status">{t('common.loading')}</p>}
  {resource.error&&<div role="alert"><p>{resource.error}</p><Button data-account-retry variant="secondary" disabled={resource.busy||resource.loading} onClick={()=>void resource.retry()}>{t('common.retry')}</Button></div>}
  {resource.data&&<div className="mq-account-address-layout" data-editing={!!editingId}><div className="mq-account-address-list">
   {addresses.length===0&&<p data-address-empty>{t('addresses.empty')}</p>}
   {addresses.map(a=><button key={a.id} type="button" disabled={resource.busy||!resource.fresh} aria-pressed={activeId===a.id} onClick={()=>edit(a.id)} className="rounded-lg bg-fill-soft p-4 text-left text-primary"><strong>{a.label} {a.isDefault&&'★'}</strong><p>{a.address}<AddressDetails entrance={a.entrance} floor={a.floor} apartment={a.apartment} t={t}/></p><span>{t('addresses.change')}</span></button>)}
   <Button variant="secondary" disabled={resource.busy||!resource.fresh} onClick={()=>edit('new')}>{t('addresses.addNew')}</Button>
  </div><div className="mq-account-address-form-pane" data-editing={!!editingId}>
   <AddressEditor value={value} onChange={next=>{setEditingId(activeId);setForm(next);}} isNew={activeId==='new'} submitting={resource.busy} disabled={resource.loading||!resource.fresh} pendingAction={resource.action==='DELETE'?'delete':'save'} error="" t={t} onSave={save}
    onDelete={activeId==='new'?undefined:()=>void resource.mutate(`/addresses/${encodeURIComponent(activeId)}`,{method:'DELETE'},()=>{resource.replaceData(addresses.filter(a=>a.id!==activeId));setEditingId(null);setForm(emptyForm);})}/>
  </div></div>}
 </section>;
}
