'use client';
import {useEffect,useRef,type ReactNode} from 'react';
export function Dialog({open,title,busy=false,onClose,children}:{open:boolean;title:string;busy?:boolean;onClose:()=>void;children:ReactNode}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const node=ref.current;if(!open||!node)return;
  const previous=document.activeElement;
  node.showModal();
  return()=>{node.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
 },[open]);
 return open?<dialog ref={ref} aria-label={title} onCancel={event=>{event.preventDefault();if(!busy)onClose();}} className="fixed inset-0 m-auto w-[calc(100%_-_32px)] max-w-[420px] rounded-lg border-0 bg-surface p-6 text-ink shadow-xl backdrop:bg-black/30"><div className="flex flex-col gap-4">{children}</div></dialog>:null;
}
