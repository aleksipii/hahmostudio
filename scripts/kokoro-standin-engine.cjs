'use strict';
// Deterministinen tavuääni: jokainen sana = soinnillinen jakso satunnaisella F0:lla ja formanttimaisella kohinalla.
const seed=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const rng=s=>()=>{s=Math.imul(s^(s>>>15),2246822507)^Math.imul(s^(s>>>13),3266489909);s^=s>>>16;return (s>>>0)/4294967296;};
class KokoroTTS{
 static async from_pretrained(){return new KokoroTTS();}
 async generate(text,{voice,speed=1}={}){
  const sr=24000,r=rng(seed(voice+'|'+text)),words=text.split(/\s+/).filter(Boolean),out=[];
  const push=n=>{for(let i=0;i<n;i++)out.push(0);};push(Math.round(.12*sr));
  for(const w of words){
   const letters=w.replace(/[^a-z]/gi,'').length||1,dur=(.08+.045*letters)/speed,n=Math.round(dur*sr),f0=110+r()*120;
   let phase=0,lp=0;
   for(let i=0;i<n;i++){
    const t=i/n,env=Math.sin(Math.PI*t)**.7*(.55+.45*Math.sin(2*Math.PI*t*Math.max(1,Math.round(letters/2)))**2);
    phase+=2*Math.PI*(f0*(1+.08*Math.sin(2*Math.PI*3*i/sr)))/sr;
    lp+=.25*((r()*2-1)-lp);
    out.push(env*(.35*Math.sin(phase)+.18*Math.sin(2*phase)+.1*Math.sin(3*phase)+.22*lp));
   }
   push(Math.round((/[.,!?]$/.test(w)?.28:.06+r()*.07)*sr/speed));
  }
  return {audio:Float32Array.from(out),sampling_rate:sr};
 }
}
module.exports={KokoroTTS};
