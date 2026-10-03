import type {Animation} from './animation-model.ts';import {sampleTrack,putKeyframe} from './animation-model.ts';import type {QuickProfile} from './quick-animation.ts';
export const characterViews={front:'Edestä',left:'Vasen profiili',right:'Oikea profiili',back:'Takaa'} as const;
export type CharacterView=keyof typeof characterViews;
export function currentView(q:QuickProfile):CharacterView{return (Object.keys(q.views??{}) as CharacterView[]).find(v=>q.views![v]?.root===q.roles.root)??'front';}
export function selectCharacterView(a:Animation,q:QuickProfile,view:CharacterView,frame:number){const roles=q.views?.[view];if(!roles)throw new Error('Tällä hahmolla ei ole valittua kuvakulmaa. Valitse monikulmahahmo.');const pose=sampleTrack(a.tracks.find(t=>t.key===q.roles.root),frame);let animation=a;for(const map of Object.values(q.views!)){if(map)animation=putKeyframe(animation,map.root,{...pose,opacity:map.root===roles.root?1:0,frame,easing:'hold'});}return {animation,profile:{...q,roles:{...roles}}};}

export function viewAtFrame(q:QuickProfile,a:Animation,frame:number):CharacterView{return (Object.keys(q.views??{}) as CharacterView[]).find(v=>sampleTrack(a.tracks.find(t=>t.key===q.views![v]!.root),frame).opacity>.5)??currentView(q);}
