'use client';
import {PublicReadState} from '../components/PublicReadState';
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}) {return <PublicReadState kind="error" retry={reset}/>}
