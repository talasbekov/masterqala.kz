"use client";
import {useParams} from 'next/navigation';
import {UrgentMasterContainer} from '@/components/desktop-urgent/UrgentMasterContainer';
export default function OrderPage(){const{id}=useParams<{id:string}>();return <UrgentMasterContainer key={id} id={id}/>;}
