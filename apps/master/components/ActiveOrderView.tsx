'use client';
import type {ActiveOrder} from '@/lib/activeOrder';
import {UrgentMasterContainer} from './desktop-urgent/UrgentMasterContainer';
export function ActiveOrderView({order,onChanged}:{order:ActiveOrder;onChanged:()=>void}) {
 return <UrgentMasterContainer id={order.id} onChanged={onChanged}/>;
}
