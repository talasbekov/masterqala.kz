import type {OrderDetail} from '@/lib/orderTypes';
export function pilotActions(order:Pick<OrderDetail,'status'|'workPrice'|'review'>):string[]{
 const known=typeof order.workPrice==='number'&&Number.isFinite(order.workPrice)&&order.workPrice>=0;
 if(['CREATED','SEARCHING','ACCEPTED','MASTER_ON_WAY'].includes(order.status))return ['cancel'];
 if(order.status==='NO_MASTERS')return ['retry-search','cancel'];
 if(order.status==='AWAITING_PRICE_CONFIRM')return [...(known?['confirm-price']:[]),'reject-price'];
 if(order.status==='DONE')return ['confirm-completion'];
 if(order.status==='CLOSED'&&!order.review)return ['review'];
 return [];
}
export function validOrderPoint(lat:unknown,lng:unknown):boolean{return typeof lat==='number'&&typeof lng==='number'&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;}
