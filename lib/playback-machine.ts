export const playbackStates=['idle','ladataan','valmis','toistaa','tauko','pysäytetty','valmis_loppu','virhe'] as const;
export type PlaybackState=typeof playbackStates[number];
export type PlaybackAction='load'|'ready'|'play'|'pause'|'resume'|'stop'|'seek'|'restart'|'end'|'fail';
export const allowed:Record<PlaybackState,Partial<Record<PlaybackAction,PlaybackState>>>={
 idle:{load:'ladataan',fail:'virhe'},ladataan:{ready:'valmis',fail:'virhe',stop:'pysäytetty'},valmis:{play:'toistaa',seek:'valmis',restart:'toistaa',stop:'pysäytetty',load:'ladataan',fail:'virhe'},toistaa:{pause:'tauko',stop:'pysäytetty',seek:'tauko',end:'valmis_loppu',load:'ladataan',fail:'virhe',restart:'toistaa'},tauko:{resume:'toistaa',play:'toistaa',seek:'tauko',stop:'pysäytetty',restart:'toistaa',load:'ladataan',fail:'virhe'},pysäytetty:{play:'toistaa',restart:'toistaa',seek:'pysäytetty',load:'ladataan',fail:'virhe'},valmis_loppu:{play:'toistaa',restart:'toistaa',seek:'tauko',stop:'pysäytetty',load:'ladataan',fail:'virhe'},virhe:{load:'ladataan',stop:'pysäytetty'}};
export function transition(state:PlaybackState,action:PlaybackAction){const next=allowed[state][action];if(!next)throw Error(`Kielletty toistosiirtymä: ${state} → ${action}`);return next;}
export interface PlaybackScene {id:string;start:number;end:number}
/** Clock-driven fractional frames; transport is independent of refresh rate. */
export class PlaybackController {
 state:PlaybackState='idle';frame=0;sceneId='';private started=0;private initial=0;
 fps:number;duration:number;scenes:PlaybackScene[];
 constructor(fps:number,duration:number,scenes:PlaybackScene[]=[]){this.fps=fps;this.duration=duration;this.scenes=scenes;if(!Number.isFinite(fps)||fps<=0||!Number.isFinite(duration)||duration<1||scenes.some(s=>s.end<=s.start||s.start<0||s.end>duration))throw Error('Virheellinen toistoalue.');this.send('load');this.send('ready');}
 send(action:PlaybackAction,now=0,seek?:number){
  const next=transition(this.state,action);
  if(['pause','stop','seek'].includes(action)&&this.state==='toistaa')this.tick(now);
  if(action==='stop'||action==='restart'||(action==='play'&&this.state==='valmis_loppu'))this.frame=0;
  if(action==='seek'){if(seek===undefined||!Number.isFinite(seek)||seek<0||seek>=this.duration)throw Error('Virheellinen toistokohta.');this.frame=seek;}
  this.state=next;if(next==='toistaa'){this.started=now;this.initial=this.frame;}this.updateScene();
 }
 tick(now:number){if(this.state!=='toistaa')return this.frame;this.frame=Math.min(this.duration-1,this.initial+Math.max(0,now-this.started)/1000*this.fps);if(this.initial+(now-this.started)/1000*this.fps>=this.duration)this.state=transition(this.state,'end');this.updateScene();return this.frame;}
 private updateScene(){this.sceneId=this.scenes.find(s=>this.frame>=s.start&&this.frame<s.end)?.id??'';}
}
export function frameMetrics(intervals:number[]){const samples=intervals.filter(n=>Number.isFinite(n)&&n>0);const total=samples.reduce((a,b)=>a+b,0),sorted=[...samples].sort((a,b)=>a-b);return {samples:samples.length,fps:total?samples.length*1000/total:0,p95Ms:sorted[Math.floor((sorted.length-1)*.95)]??0,slowFrames:samples.filter(n=>n>1000/55).length};}
