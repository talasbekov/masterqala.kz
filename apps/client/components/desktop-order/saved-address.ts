import type {NewOrderDraft} from '../../lib/new-order-draft';
export type SavedOrderAddress={id:string;label:string;address:string;entrance?:string|null;floor?:string|null;apartment?:string|null;comment?:string|null;lat?:unknown;lng?:unknown};
export function savedAddressPatch(address:SavedOrderAddress):Partial<NewOrderDraft>{
 const {lat,lng}=address;
 const coordinates=typeof lat==='number'&&Number.isFinite(lat)&&Math.abs(lat)<=90&&typeof lng==='number'&&Number.isFinite(lng)&&Math.abs(lng)<=180;
 return {addressText:address.address,entrance:address.entrance??'',floor:address.floor??'',apartment:address.apartment??'',addressComment:address.comment??'',district:'',...(coordinates?{geo:{lat,lng}}:{}),locationChosen:coordinates,locationNeedsConfirmation:!coordinates};
}
export function savedAddresses(value:unknown):SavedOrderAddress[]{
 if(!Array.isArray(value)||value.some(item=>!item||typeof item.id!=='string'||typeof item.label!=='string'||typeof item.address!=='string'||['entrance','floor','apartment','comment'].some(key=>item[key]!=null&&typeof item[key]!=='string')))throw new Error('Invalid address list');
 return value;
}
/** Consume a validated catalog intent from this history entry after categories load. */
export function categoryIntent(search:string,categories:readonly {id:string}[]):{categoryId:string|null;href:string}|null{
 const params=new URLSearchParams(search),ids=params.getAll('category');if(!ids.length)return null;
 const categoryId=ids.length===1&&categories.some(category=>category.id===ids[0])?ids[0]:null;
 params.delete('category');const rest=params.toString();return {categoryId,href:'/'+(rest?'?'+rest:'')};
}
