export type PanelSizes={library:number;inspector:number;timeline:number};
export const defaultSizes:PanelSizes={library:260,inspector:300,timeline:210};
export const panelLimits={library:[200,480],inspector:[240,520],timeline:[120,440]} as const;
export function resizePanel(s:PanelSizes,key:keyof PanelSizes,value:number):PanelSizes{const [min,max]=panelLimits[key];return {...s,[key]:Math.round(Math.max(min,Math.min(max,Number.isFinite(value)?value:defaultSizes[key])))};}
export function readSizes(text:string|null):PanelSizes{try{const v=JSON.parse(text??'null');if(v&&Object.keys(defaultSizes).every(k=>Number.isFinite(v[k])))return (Object.keys(defaultSizes) as (keyof PanelSizes)[]).reduce((s,k)=>resizePanel(s,k,v[k]),{...defaultSizes});}catch{}return {...defaultSizes};}
/** Keep a 320px stage, shrinking inspector first and library second at their usable minimum widths at narrow widths. */
export function fitPanels(s:PanelSizes,width:number,library:boolean,inspector:boolean){let l=library?s.library:0,r=inspector?s.inspector:0;const room=Math.max(0,width-320-(library?6:0)-(inspector?6:0));if(l+r>room){r=Math.max(inspector?240:0,room-l);l=Math.max(library?200:0,Math.min(l,room-r));}return {library:l,inspector:r};}

/** A dragged pane can grow on constrained displays by reducing the opposite pane. */
export function resizeForSpace(s:PanelSizes,key:'library'|'inspector',value:number,width:number,library:boolean,inspector:boolean):PanelSizes{
 const n=resizePanel(s,key,value),other=key==='library'?'inspector':'library';
 const room=Math.max(0,width-320-(library?6:0)-(inspector?6:0));
 if(library&&inspector){n[key]=Math.min(n[key],Math.max(panelLimits[key][0],room-panelLimits[other][0]));n[other]=Math.min(n[other],Math.max(panelLimits[other][0],room-n[key]));}
 else n[key]=Math.min(n[key],Math.max(panelLimits[key][0],room));return n;
}
