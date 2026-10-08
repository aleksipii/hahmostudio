/** 16-bittinen PCM-WAV alkuperäisellä näytetaajuudella (ei uudelleennäytteistystä, ei monoksi miksausta; enintään 2 kanavaa). Vientiä varten: puhetunnistuksen `encodeSpeechWav` näytteistää 16 kHz mono. */
export function encodePcmWav(channels:Float32Array[],sampleRate:number,maxSeconds=1200):Uint8Array{
 if(!channels.length||!channels[0].length)throw new Error('Äänitiedosto on tyhjä.');
 if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000)throw new Error('Virheellinen näytetaajuus.');
 const used=channels.slice(0,2),frames=used[0].length;
 if(frames/sampleRate>maxSeconds)throw new Error(`Ääni ylittää ${maxSeconds} s.`);
 const out=new Uint8Array(44+frames*used.length*2),view=new DataView(out.buffer),text=(at:number,s:string)=>{for(let i=0;i<s.length;i++)out[at+i]=s.charCodeAt(i);};
 text(0,'RIFF');view.setUint32(4,out.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,used.length,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*used.length*2,true);view.setUint16(32,used.length*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,frames*used.length*2,true);
 let at=44;for(let i=0;i<frames;i++)for(const channel of used){const v=Math.max(-1,Math.min(1,channel[i]??0));view.setInt16(at,Math.round(v<0?v*32768:v*32767),true);at+=2;}
 return out;
}
