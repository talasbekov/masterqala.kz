import {JOBS} from '../src/queue/queue.constants';
export function completedMarkedTimeout(call:{name:string;data:any;finished:boolean;error?:unknown},marker:string):boolean {
 return call.name===JOBS.SEQUENTIAL_TIMEOUT&&call.data?.testDeliveryMarker===marker&&call.finished&&!call.error;
}
