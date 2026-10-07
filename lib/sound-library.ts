/**
 * Ohjelmallisesti tuotetut äänet (vaihe E). Kaikki äänet syntetisoidaan tässä tiedostossa deterministisesti
 * (sama syöte → samat näytteet), joten ne ovat alkuperäisiä ja vapaasti käytettäviä (CC0). Ei näytteitä,
 * ei verkkoa, ei puhesynteesiä. Tuotos: mono Float32, 48 kHz, arvot noin −1…1.
 */
export const SOUND_RATE=48000;
export const sfxIds=['askel','napautus','varina','soitto','ovi','koputus','whoosh','istuutuminen'] as const;
export type SfxId=typeof sfxIds[number];
export const sfxNames:Record<SfxId,string>={askel:'Askel',napautus:'Napautus',varina:'Puhelimen värinä',soitto:'Puhelin soi',ovi:'Ovi',koputus:'Koputus',whoosh:'Suhahdus',istuutuminen:'Istuutuminen'};

/** Deterministinen kohina (LCG) välillä −1…1. */
export function noise(seed:number){let s=(seed>>>0)||1;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/2147483648)-1;}
const onePole=(cut:number,rate:number)=>1-Math.exp(-2*Math.PI*cut/rate);
const env=(t:number,attack:number,decay:number)=>t<attack?t/attack:Math.exp(-(t-attack)/decay);

/** Tehosteen näytteet. `variant` vaihtelee askelia ja koputuksia hieman (ei kahta täysin samaa askelta peräkkäin). */
/** Lattia: vaikuttaa vain askeliin. `oletus` on alkuperäinen askel (studio, tuntematon ympäristö). */
export const surfaces=['oletus','puu','kova','nurmi'] as const;
export type Surface=typeof surfaces[number];
export const surfaceNames:Record<Surface,string>={oletus:'Oletus',puu:'Puulattia',kova:'Kova pinta (katu, laatta)',nurmi:'Nurmi'};
const stepParams:Record<Surface,{cut:number;attack:number;decay:number;body:number;bodyGain:number;bodyDecay:number;gain:number}>={
 oletus:{cut:700,attack:.002,decay:.035,body:85,bodyGain:.55,bodyDecay:.045,gain:1.6},
 puu:{cut:1250,attack:.0015,decay:.03,body:120,bodyGain:.5,bodyDecay:.05,gain:1.25},
 kova:{cut:2700,attack:.0008,decay:.018,body:70,bodyGain:.3,bodyDecay:.03,gain:1},
 nurmi:{cut:380,attack:.004,decay:.06,body:58,bodyGain:.25,bodyDecay:.07,gain:1.3},
};
export function synthSfx(id:SfxId,variant=0,rate=SOUND_RATE,surface:Surface='oletus'):Float32Array{
 const seconds={askel:.22,napautus:.08,varina:1.2,soitto:2,ovi:.9,koputus:.75,whoosh:.45,istuutuminen:.45}[id],n=Math.round(seconds*rate),out=new Float32Array(n),rnd=noise(1009+sfxIds.indexOf(id)*7919+variant*104729);
 let lp=0,lp2=0;const a=(f:number)=>onePole(f,rate);
 for(let i=0;i<n;i++){const t=i/rate;let v=0;
  switch(id){
   case'askel':{const sp=stepParams[surface],x=rnd();lp+=a(sp.cut+variant%3*90)*(x-lp);v=lp*env(t,sp.attack,sp.decay)*sp.gain+Math.sin(2*Math.PI*(sp.body+variant%4*6)*t)*env(t,.003,sp.bodyDecay)*sp.bodyGain;break;}
   case'napautus':{const x=rnd();lp+=a(3500)*(x-lp);v=(x-lp)*env(t,.0005,.006)*.9+Math.sin(2*Math.PI*1900*t)*env(t,.001,.018)*.35;break;}
   case'varina':{const on=(t%.4)<.3?1:0,f=172;v=Math.sign(Math.sin(2*Math.PI*f*t))*.22*on*(.75+.25*Math.sin(2*Math.PI*9*t));lp+=a(900)*(v-lp);v=lp;break;}
   case'soitto':{const notes=[1318.5,1046.5,1318.5,1567.98],k=Math.floor(t/.25)%8,f=notes[k%4],local=t%.25,on=k<4?1:0;v=(Math.sin(2*Math.PI*f*t)*.6+Math.sin(4*Math.PI*f*t)*.15)*env(local,.008,.09)*on*.5;break;}
   case'ovi':{const f=150-40*t+8*Math.sin(2*Math.PI*11*t);const saw=2*((f*t)%1)-1;lp+=a(1200)*(saw*.5+rnd()*.15-lp);v=lp*(t<.65?Math.sin(Math.PI*t/.65)*.5:0);if(t>.62){const u=t-.62,x=rnd();lp2+=a(500)*(x-lp2);v+=lp2*env(u,.002,.05)*1.8+Math.sin(2*Math.PI*70*u)*env(u,.002,.08)*.6;}break;}
   case'koputus':{for(const k of [0,.22,.44]){const u=t-k;if(u>=0&&u<.2){const x=rnd();v+=Math.sin(2*Math.PI*(210+variant*5)*u)*env(u,.001,.03)*.7+x*env(u,.0005,.008)*.3;}}break;}
   case'whoosh':{const x=rnd(),cut=300+2600*Math.sin(Math.PI*t/seconds);lp+=a(cut)*(x-lp);lp2+=a(cut*.4)*(x-lp2);v=(lp-lp2)*Math.sin(Math.PI*t/seconds)**2*1.4;break;}
   case'istuutuminen':{const x=rnd();lp+=a(380)*(x-lp);v=lp*env(t,.01,.08)*1.9+Math.sin(2*Math.PI*62*t)*env(t,.005,.07)*.5;if(t>.18&&t<.4){const f=320+40*Math.sin(2*Math.PI*6*t);v+=Math.sin(2*Math.PI*f*t)*.05*Math.sin(Math.PI*(t-.18)/.22);}break;}
  }
  out[i]=v;
 }
 // Lyhyt häivytys reunoihin: ei napsahduksia.
 const fade=Math.min(n>>1,Math.round(.003*rate));for(let i=0;i<fade;i++){const g=i/fade;out[i]*=g;out[n-1-i]*=g;}
 return out;
}

/** Huoneen kaiku tehosteille: wet = märän signaalin osuus, decay = kaiun kesto (s). Yksinkertainen deterministinen Schroeder-kaiku. */
export type Room={wet:number;decay:number};
export function applyRoom(pcm:Float32Array,rate:number,room:Room):Float32Array{
 if(room.wet<=0||!pcm.length)return pcm;
 const tail=Math.round(room.decay*rate),out=new Float32Array(pcm.length+tail),dry=new Float32Array(out.length);dry.set(pcm);
 // Rinnakkaiset kampasuodattimet (palaute) sekä kaksi sarjaan kytkettyä läpipäästösuodatinta.
 const combs=[29.7,37.1,41.1,43.7].map(ms=>({d:Math.round(ms/1000*rate),g:Math.pow(10,-3*(ms/1000)/room.decay),buf:new Float32Array(Math.round(ms/1000*rate)),pos:0}));
 const mix=new Float32Array(out.length);
 for(let i=0;i<out.length;i++){let sum=0;for(const c of combs){const y=c.buf[c.pos];c.buf[c.pos]=dry[i]+y*c.g;c.pos=(c.pos+1)%c.d;sum+=y;}mix[i]=sum/combs.length;}
 for(const ms of [5,1.7]){const d=Math.round(ms/1000*rate),buf=new Float32Array(d);let pos=0;for(let i=0;i<mix.length;i++){const y=buf[pos],x=mix[i]+y*.7;buf[pos]=x;pos=(pos+1)%d;mix[i]=y-x*.7;}}
 // Hännän häivytys: kaiku loppuu nollaan ilman napsahdusta.
 const fade=Math.min(tail,Math.round(.03*rate));
 for(let i=0;i<out.length;i++){const end=out.length-1-i,g=end<fade?end/fade:1;out[i]=dry[i]+mix[i]*room.wet*2.2*g;}
 return out;
}

/* ───────────────────────── Musiikki ───────────────────────── */

export type MusicMood='iloinen'|'jännittävä'|'rauhallinen'|'surullinen';
type MoodSpec={bpm:number;root:number;minor:boolean;progression:number[];arp:boolean;drums:'none'|'soft'|'pulse';pad:number;melody:boolean};
export const moodSpecs:Record<MusicMood,MoodSpec>={
 iloinen:{bpm:112,root:60,minor:false,progression:[0,4,5,3],arp:true,drums:'soft',pad:.5,melody:true},
 jännittävä:{bpm:126,root:57,minor:true,progression:[0,0,5,4],arp:true,drums:'pulse',pad:.6,melody:false},
 rauhallinen:{bpm:72,root:62,minor:false,progression:[0,3,5,4],arp:false,drums:'none',pad:.9,melody:true},
 surullinen:{bpm:64,root:57,minor:true,progression:[0,5,3,4],arp:false,drums:'none',pad:.9,melody:true},
};
const scale=(minor:boolean)=>minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];
const hz=(midi:number)=>440*2**((midi-69)/12);
/**
 * Alkuperäinen taustamusiikki tunnelman mukaan: sointukulku (pad), basso, arpeggio/melodia ja hienovarainen rytmi.
 * Pituus `seconds`, alku- ja loppuhäivytys. Sama tunnelma + sama pituus + sama siemen → samat näytteet.
 */
export function synthMusic(mood:MusicMood,seconds:number,seed=1,rate=SOUND_RATE):Float32Array{
 const m=moodSpecs[mood],n=Math.max(1,Math.round(seconds*rate)),out=new Float32Array(n),beat=60/m.bpm,bar=beat*4,sc=scale(m.minor),rnd=noise(seed*31+m.bpm);
 const chordAt=(t:number)=>{const deg=m.progression[Math.floor(t/bar)%m.progression.length];return [0,2,4].map(k=>m.root+sc[(deg+k)%7]+12*Math.floor((deg+k)/7));};
 // Melodia: deterministinen kävely sävelasteikolla, yksi sävel per tahti-iskua ×2.
 const melodySteps=Math.ceil(seconds/(beat*2))+2,melody:number[]=[];let deg=4;for(let i=0;i<melodySteps;i++){deg=Math.max(0,Math.min(9,deg+[-2,-1,0,1,1,2][Math.floor((rnd()+1)*3)%6]));melody.push(m.root+12+sc[deg%7]+12*Math.floor(deg/7));}
 let lp=0;
 for(let i=0;i<n;i++){const t=i/rate,chord=chordAt(t),inBar=t%bar,inBeat=t%beat;let v=0;
  // Pad: kolme hieman epävireistä kolmioaaltoa, pehmeä tahtikohtainen verho.
  const padEnv=Math.min(1,inBar/.35)*(.85+.15*Math.cos(2*Math.PI*inBar/bar));for(const note of chord){const f=hz(note);for(const det of [-.0015,.0015]){const ph=(f*(1+det)*t)%1;v+=(4*Math.abs(ph-.5)-1)*.045*m.pad*padEnv;}}
  // Basso juurisävelestä joka iskulla.
  const bassF=hz(chord[0]-12);v+=Math.sin(2*Math.PI*bassF*t)*.16*env(inBeat,.01,beat*.6);
  // Arpeggio kahdeksasosina tai melodia puolinuotteina.
  if(m.arp){const k=Math.floor(t/(beat/2))%4,note=[...chord,chord[1]+12][k],u=t%(beat/2);v+=Math.sin(2*Math.PI*hz(note+12)*t)*.07*env(u,.004,.12);}
  if(m.melody){const idx=Math.floor(t/(beat*2)),u=t%(beat*2),f=hz(melody[idx]);v+=(Math.sin(2*Math.PI*f*t)*.6+Math.sin(4*Math.PI*f*t)*.2)*.08*env(u,.03,beat*1.1);}
  // Rytmi: pehmeä potku iskuille 1 ja 3, sulkeutunut hi-hat kahdeksasosille.
  if(m.drums!=='none'){const beatIndex=Math.floor(t/beat)%4;if(m.drums==='pulse'||beatIndex%2===0)v+=Math.sin(2*Math.PI*(55+60*Math.exp(-inBeat*40))*inBeat)*.22*env(inBeat,.002,.09);const x=rnd();lp+=onePole(6000,rate)*(x-lp);const hat=t%(beat/2);v+=(x-lp)*.035*env(hat,.001,.03);}
  out[i]=v;
 }
 const fadeIn=Math.min(n,Math.round(1*rate)),fadeOut=Math.min(n,Math.round(1.5*rate));for(let i=0;i<fadeIn;i++)out[i]*=i/fadeIn;for(let i=0;i<fadeOut;i++)out[n-1-i]*=i/fadeOut;
 return out;
}
