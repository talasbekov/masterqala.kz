type Point={lat:number;lng:number};
type PinMap={
 getCenter:()=>Point;getZoom:()=>number;
 setView:(point:[number,number],zoom:number,options:{animate:boolean;reset:boolean})=>unknown;
 invalidateSize:(options:{pan:boolean;debounceMoveend:boolean})=>unknown;
 on:(event:string,handler:()=>void)=>unknown;off:(event:string,handler:()=>void)=>unknown;
};
const equal=(a:Point,b:Point)=>Math.abs(a.lat-b.lat)<1e-9&&Math.abs(a.lng-b.lng)<1e-9;
/** Programmatic center/resize events are not deliberate address edits. */
export function createPinCenterSync(map:PinMap,initial:Point,getHandler:()=>((point:Point)=>void)|undefined) {
 let desired={...initial},active=true,programmatic=0;
 function sync(point:Point){
  if(!active)return;
  desired={...point};
  if(equal(map.getCenter(),desired))return;
  programmatic++;
  try{const options={animate:false,reset:true};map.setView([desired.lat,desired.lng],map.getZoom(),options);}
  finally{programmatic--;}
 }
 function moved(){
  if(!active||programmatic)return;
  const point=map.getCenter(),handler=getHandler();
  if(!handler||equal(point,desired))return;
  desired={lat:point.lat,lng:point.lng};
  handler({...desired});
 }
 function resized(){if(active)sync(desired);}
 map.on('moveend',moved);map.on('resize',resized);
 return {
  sync,
  resize(){if(!active)return;programmatic++;try{map.invalidateSize({pan:true,debounceMoveend:false});sync(desired);}finally{programmatic--;}},
  dispose(){active=false;map.off('moveend',moved);map.off('resize',resized);},
 };
}
