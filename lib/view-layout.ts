export type ViewLayout={library:boolean;inspector:boolean;timeline:boolean;status:boolean};
export const defaultLayout:ViewLayout={library:true,inspector:true,timeline:false,status:true};
export function readLayout(text:string|null):ViewLayout{try{const v=JSON.parse(text??'null');if(v&&Object.keys(defaultLayout).every(k=>typeof v[k]==='boolean'))return {library:v.library,inspector:v.inspector,timeline:v.timeline,status:v.status};}catch{}return {...defaultLayout};}
