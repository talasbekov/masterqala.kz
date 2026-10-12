"use client";
import {useParams} from 'next/navigation';
import {DirectMasterContainer} from '@/components/DirectMasterContainer';
export default function OrderPage(){const{id}=useParams<{id:string}>();return <DirectMasterContainer key={id} id={id}/>;}
