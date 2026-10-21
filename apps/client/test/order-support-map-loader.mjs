// Map rendering is unrelated to order Help routing. Keep the actual route/view;
// replace only the dynamic Leaflet surface for these headless event tests.
export async function resolve(specifier,context,nextResolve){
 if(specifier==='next/dynamic'||specifier==='next/dynamic.js')return {url:'data:text/javascript,'+encodeURIComponent('export default function dynamic(){return function MapFixture(){return null}}'),shortCircuit:true};
 return nextResolve(specifier,context);
}
