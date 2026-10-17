'use client';
import {useEffect,useRef,useState} from 'react';
import {savedAddresses,type SavedOrderAddress} from './saved-address';
type Copy={savedAddresses:string;savedAddressChoose:string;savedAddressEmpty:string;savedAddressError:string;loading:string;retry:string};
type Props={ownerId:string;api:(path:string,options?:RequestInit)=>Promise<unknown>;copy:Copy;onApply:(address:SavedOrderAddress)=>void;disabled?:boolean};
export function SavedAddressPicker(props:Props){return <OwnerPicker key={props.ownerId} {...props}/>;}
function OwnerPicker({ownerId,api,copy:c,onApply,disabled=false}:Props){
 const [state,setState]=useState<{loading:boolean;error:boolean;addresses:SavedOrderAddress[]}>({loading:true,error:false,addresses:[]});
 const [retry,setRetry]=useState(0),[selected,setSelected]=useState('');
 const current=useRef<AbortController|null>(null);
 useEffect(()=>{
  const controller=new AbortController();current.current=controller;setSelected('');setState({loading:true,error:false,addresses:[]});
  if(ownerId)api('/addresses',{signal:controller.signal}).then(savedAddresses).then(addresses=>{if(!controller.signal.aborted)setState({loading:false,error:false,addresses});}).catch(()=>{if(!controller.signal.aborted)setState({loading:false,error:true,addresses:[]});});
  else setState({loading:false,error:false,addresses:[]});
  return()=>controller.abort();
 },[ownerId,api,retry]);
 return <div className="desktop-saved-addresses">
  <label className="desktop-field"><span>{c.savedAddresses}</span><select value={selected} disabled={disabled||state.loading||state.error||!state.addresses.length} onChange={event=>{if(!current.current||current.current.signal.aborted||disabled||state.loading||state.error)return;if(!event.target.value){setSelected('');return;}const address=state.addresses.find(item=>item.id===event.target.value);if(!address)return;setSelected(address.id);onApply(address);}}><option value="">{c.savedAddressChoose}</option>{state.addresses.map(address=><option key={address.id} value={address.id}>{address.label} — {address.address}</option>)}</select></label>
  {state.loading?<p role="status">{c.loading}</p>:state.error?<div role="alert"><p>{c.savedAddressError}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>{c.retry}</button></div>:!state.addresses.length?<p role="status">{c.savedAddressEmpty}</p>:null}
 </div>;
}
