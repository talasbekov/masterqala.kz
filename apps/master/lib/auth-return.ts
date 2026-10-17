const routes=new Set(['','history','order','planned','become-master','disputes']);
export function safeMasterReturn(candidate:string|null):string {
 if(!candidate||!candidate.startsWith('/')||candidate.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(candidate))return '/';
 try{const url=new URL(candidate,'https://masterqala.local'),path=decodeURIComponent(url.pathname);if(url.origin!=='https://masterqala.local'||path.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(path)||!routes.has(path.split('/')[1]))return '/';return url.pathname+url.search+url.hash;}catch{return '/';}
}
export function masterLoginUrl(candidate:string){const path=safeMasterReturn(candidate);return path==='/'?'/login':'/login?'+new URLSearchParams({returnTo:path});}
