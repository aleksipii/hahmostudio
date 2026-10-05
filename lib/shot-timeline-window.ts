/** Visible index window for a horizontally scrolled shot rail (virtualization helper). */
export function visibleShotWindow(totalShots:number,scrollLeft:number,viewportWidth:number,itemWidth:number,padding=2){
 if(totalShots<=0||itemWidth<=0)return {start:0,end:0,indices:[] as number[]};
 const start=Math.max(0,Math.floor(scrollLeft/itemWidth)-padding);
 const visible=Math.ceil(viewportWidth/itemWidth)+padding*2;
 const end=Math.min(totalShots,start+visible);
 return {start,end,indices:Array.from({length:end-start},(_,i)=>start+i)};
}
