export const MAX_FILE_BYTES=128*1024*1024;
export const fileKinds={project:['hahmo'],character:['psd','png'],audio:['mp3','wav','ogg','m4a'],rig:['json'],animation:['json'],series:['hahmo','sarja']};
export const actions=['open','import','audio','save','saveAs','export','undo','redo','play','save-for-close'];
export function validSender(event,window,origin){return !!window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame?.url?.startsWith(origin+'/');}
export function allowedMedia(permission,details={},url,origin){return permission==='media'&&url?.startsWith(origin+'/')&&Array.isArray(details.mediaTypes)&&details.mediaTypes.length>0&&details.mediaTypes.every(type=>type==='video'||type==='audio');}
export function saveRequest(value){if(!value||typeof value.name!=='string'||value.name.length>240||!value.name.length||/[\/\\\x00-\x1f]/.test(value.name)||!(value.bytes instanceof Uint8Array)||value.bytes.length>MAX_FILE_BYTES||!value.bytes.length||!['project','export'].includes(value.kind)||typeof value.saveAs!=='boolean'||value.kind==='project'&&!value.name.endsWith('.hahmo'))throw new Error('Virheellinen tallennuspyyntö.');return value;}
export function safeRecent(value){if(!Array.isArray(value))return [];return value.filter(v=>v&&typeof v.id==='string'&&typeof v.path==='string'&&v.path.startsWith('/')&&v.path.toLowerCase().endsWith('.hahmo')).slice(0,10).map(v=>({id:v.id,path:v.path}));}

export function allowedMediaCheck(permission,details,requestingOrigin,origin){return permission==='media'&&requestingOrigin===origin&&['audio','video','unknown'].includes(details?.mediaType);}
