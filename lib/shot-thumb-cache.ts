const cache=new Map<string,string>();
const MAX=96;

export function shotThumbCacheKey(presentationId:string,eventId:string,at:number,width:number,height:number){
 return `${presentationId}:${eventId}:${at.toFixed(4)}:${width}x${height}`;
}

export function getShotThumbDataUrl(key:string){
 return cache.get(key);
}

export function setShotThumbDataUrl(key:string,dataUrl:string){
 if(cache.size>=MAX)cache.delete(cache.keys().next().value!);
 cache.set(key,dataUrl);
}

export function clearShotThumbCache(){
 cache.clear();
}
