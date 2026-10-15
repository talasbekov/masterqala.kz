'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ProfileForm} from './ProfileForm';
import {Button} from './Button';
import {useOwnedAccountResource,type AccountApi} from './hooks/useOwnedAccountResource';
export interface AccountProfile {name:string|null;phone:string;masterProfile?:{blockedUntil:string|null}|null}
export function AccountProfileView(props:{ownerId:string|null;phoneFallback?:string;api:AccountApi;t:(key:string)=>string;languageControl:ReactNode;children?:ReactNode;notice?:(profile:AccountProfile)=>ReactNode;onLogout:()=>void}){
 return <ProfileContent key={props.ownerId??'signed-out'} {...props}/>;
}
function ProfileContent({ownerId,phoneFallback='',api,t,languageControl,children,notice,onLogout}:Parameters<typeof AccountProfileView>[0]){
 const resource=useOwnedAccountResource<AccountProfile>({ownerId,path:'/users/me',api});
 const [name,setName]=useState('');const dirty=useRef(false);
 useEffect(()=>{if(resource.data&&!dirty.current)setName(resource.data.name??'');},[resource.data]);
 if(!ownerId)return null;
 return <div className="mq-profile-page"><h1>{t('profile.title')}</h1><p className="mq-profile-subtitle">{t('profile.subtitle')}</p>
  <div className="mq-profile-columns"><div className="mq-profile-personal">
   <ProfileForm name={name} phone={resource.data?.phone??phoneFallback} loading={resource.loading||!resource.fresh} saving={resource.busy} error={resource.error} t={t}
    onName={value=>{dirty.current=true;setName(value);}} languageControl={languageControl}
    onSave={()=>void resource.mutate('/users/me',{method:'PATCH',body:JSON.stringify({name})},updated=>{resource.replaceData(updated);setName(updated.name??'');dirty.current=false;})}/>
   {resource.data&&notice?.(resource.data)}
   {resource.error&&<Button data-account-retry variant="secondary" disabled={resource.busy||resource.loading} onClick={()=>void resource.retry()}>{t('common.retry')}</Button>}
  </div><div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div></div>
  <Button variant="secondary" onClick={onLogout}>{t('profile.logout')}</Button>
 </div>;
}
