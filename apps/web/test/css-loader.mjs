// Node DOM tests do not measure styles. Keep the real Leaflet module/events.
export async function load(url, context, nextLoad) {
 if (url.endsWith('.css')) return {format:'module',source:'export default {};',shortCircuit:true};
 return nextLoad(url,context);
}
