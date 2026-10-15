// Headless event tests ignore stylesheet loading; this does not establish visual parity.
export async function load(url,context,nextLoad){
 if(url.endsWith('.css'))return {format:'module',source:'export default undefined;',shortCircuit:true};
 return nextLoad(url,context);
}
