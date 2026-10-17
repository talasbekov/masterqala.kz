'use client';
import {useEffect,useRef} from 'react';
import {categoryIntent} from './saved-address';
export function useCategoryLink(search:string,categories:readonly {id:string}[]|null,onSelect:(id:string)=>void,replace:(href:string)=>void){
 const consumed=useRef<string|null>(null);
 useEffect(()=>{
  if(!new URLSearchParams(search).has('category')){consumed.current=null;return;}
  if(!categories||consumed.current===search)return;
  const intent=categoryIntent(search,categories);if(!intent)return;
  consumed.current=search;
  if(intent.categoryId)onSelect(intent.categoryId);
  replace(intent.href);
 },[search,categories,onSelect,replace]);
}
