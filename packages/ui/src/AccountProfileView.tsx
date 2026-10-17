'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ProfileForm} from './ProfileForm';
import {Button} from './Button';
import {useOwnedAccountResource,type AccountApi} from './hooks/useOwnedAccountResource';
export interface AccountProfile {name:string|null;phone:string;masterProfile?:{blockedUntil:string|null}|null}
export function AccountProfileView(props:{ownerId:string|null;phoneFallback?:string;api:AccountApi;t:(key:string)=>string;languageControl:ReactNode;children?:ReactNode;beforeHeading?:ReactNode;personalFooter?:ReactNode;notice?:(profile:AccountProfile)=>ReactNode;onLogout:()=>void;logoutPlacement?:'footer'|'aside';draftStore?:{load:(owner:string)=>{name:string}|null;save:(owner:string,value:{name:string})=>boolean;clear:(owner:string)=>void}}){
 return <ProfileContent key={props.ownerId??'signed-out'} {...props}/>;
}
function ProfileContent({ownerId,phoneFallback='',api,t,languageControl,children,beforeHeading,personalFooter,notice,onLogout,logoutPlacement='footer',draftStore}:Parameters<typeof AccountProfileView>[0]){
 const resource=useOwnedAccountResource<AccountProfile>({ownerId,path:'/users/me',api});
 const [restored]=useState(()=>ownerId?draftStore?.load(ownerId):null);
 const [name,setName]=useState(restored?.name??'');const dirty=useRef(!!restored);
 const [draftError,setDraftError]=useState(false);
 useEffect(()=>{if(resource.data&&!dirty.current)setName(resource.data.name??'');},[resource.data]);
 if(!ownerId)return null;
 return <div className="mq-profile-page">{beforeHeading}<h1>{t('profile.title')}</h1><p className="mq-profile-subtitle">{t('profile.subtitle')}</p>
  <div className="mq-profile-columns"><div className="mq-profile-personal">
   <ProfileForm name={name} phone={resource.data?.phone??phoneFallback} loading={resource.loading||!resource.fresh} saving={resource.busy} error={resource.error&&draftStore?t('profile.requestError'):resource.error} t={t}
    onName={value=>{dirty.current=true;setName(value);if(draftStore)setDraftError(!draftStore.save(ownerId,{name:value}));}} languageControl={languageControl}
    onSave={()=>void resource.mutate('/users/me',{method:'PATCH',body:JSON.stringify({name})},updated=>{resource.replaceData(updated);setName(updated.name??'');dirty.current=false;draftStore?.clear(ownerId);setDraftError(false);})}/>
   {draftError&&<p role="status">{t('profile.draftStorageFailed')}</p>}
   {resource.data&&notice?.(resource.data)}
   {resource.error&&<Button data-account-retry variant="secondary" disabled={resource.busy||resource.loading} onClick={()=>void resource.retry()}>{t('common.retry')}</Button>}
   {personalFooter}
  </div><div className="mq-profile-aside flex min-w-0 flex-1 flex-col gap-3">{children}{logoutPlacement==='aside'&&<Button variant="secondary" onClick={onLogout}>{t('profile.logout')}</Button>}</div></div>
  {logoutPlacement==='footer'&&<Button variant="secondary" onClick={onLogout}>{t('profile.logout')}</Button>}
 </div>;
}
