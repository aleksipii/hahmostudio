import type {Shape} from './backgrounds.ts';
export const propLibrary=[['phone','Älypuhelin'],['tablet','Tabletti'],['laptop','Kannettava'],['monitor','Näyttö'],['keyboard','Näppäimistö'],['mouse','Hiiri'],['mug','Muki'],['bottle','Juomapullo'],['book','Kirja'],['notebook','Vihko'],['paper','Paperi'],['pen','Kynä'],['keys','Avaimet'],['bag','Laukku'],['backpack','Reppu'],['folder','Kansio'],['table','Pöytä'],['chair','Tuoli'],['sofa','Sohva'],['board','Esittelytaulu']].map(([key,name])=>({id:key+'-prop-v1',name,representation:'2d' as const,category:['table','chair','sofa','board'].includes(key)?'kaluste':'esine',scale:['table','sofa'].includes(key)?.25:.08,views:['front'] as const}));
const r=(fill:string,...rect:number[]):Shape=>({fill,rect}),e=(fill:string,...ellipse:number[]):Shape=>({fill,ellipse}),p=(fill:string,...points:number[][]):Shape=>({fill,points});
const ink='#344b5a',blue='#86adb8',cream='#f0ead9',orange='#b57860';
export function propShapes(id:string):Shape[]{switch(id.replace('-prop-v1','')){
 case'phone':return[r(ink,.24,.02,.52,.96),r(blue,.28,.08,.44,.80),r(cream,.43,.04,.14,.015),e(cream,.5,.94,.025,.018)];
 case'tablet':return[r(ink,.10,.04,.8,.92),r(blue,.14,.09,.72,.81),e(cream,.5,.93,.018,.014)];
 case'laptop':return[r(ink,.13,.08,.74,.57),r(blue,.17,.12,.66,.49),p('#83959b',[.13,.65],[.87,.65],[1,.90],[0,.9]),r(ink,.22,.68,.56,.10),r(blue,.40,.80,.20,.07)];
 case'monitor':return[r(ink,.03,.10,.94,.59),r(blue,.075,.15,.85,.48),r(ink,.45,.69,.10,.20),r(ink,.30,.88,.40,.04)];
 case'keyboard':return[r(ink,.02,.28,.96,.43),...Array.from({length:36},(_,i)=>r(cream,.04+i%12*.08,.31+Math.floor(i/12)*.09,.06,.07)),r(cream,.27,.59,.46,.07)];
 case'mouse':return[e(ink,.5,.5,.3,.43),e(blue,.5,.45,.25,.34),r(ink,.49,.1,.02,.34),r(cream,.48,.21,.04,.08)];
 case'mug':return[e(ink,.77,.45,.20,.21),e(cream,.77,.45,.12,.13),r(orange,.13,.2,.60,.60),e(orange,.43,.8,.3,.08),e(cream,.43,.2,.3,.08),e('#765448',.43,.2,.24,.045)];
 case'bottle':return[r(ink,.39,.03,.22,.10),r(blue,.4,.13,.2,.10),p(blue,[.4,.23],[.6,.23],[.72,.39],[.72,.91],[.28,.91],[.28,.39]),r(cream,.29,.52,.42,.19),r('#afc8cc',.34,.35,.05,.52)];
 case'book':return[r(ink,.18,.09,.65,.81),r(cream,.22,.10,.57,.73),r(orange,.15,.05,.64,.82),r('#9c5f4d',.15,.05,.10,.82),r(cream,.31,.23,.34,.02),r(cream,.31,.28,.25,.014)];
 case'notebook':return[r(blue,.17,.07,.66,.86),r(cream,.25,.14,.47,.10),...Array.from({length:8},(_,i)=>e(ink,.19,.17+i*.09,.055,.025)),r('#a3c1c8',.30,.62,.37,.012)];
 case'paper':return[p(cream,[.20,.04],[.68,.04],[.82,.20],[.82,.94],[.20,.94]),p('#b8c5c4',[.68,.04],[.68,.20],[.82,.20]),...Array.from({length:6},(_,i)=>r(blue,.28,.28+i*.075,.45-i%2*.13,.016))];
 case'pen':return[p(ink,[.44,.08],[.58,.08],[.58,.78],[.50,.94],[.44,.78]),r(orange,.46,.20,.10,.51),r(cream,.45,.14,.12,.025)];
 case'keys':return[e(ink,.38,.31,.20,.20),e(cream,.38,.31,.13,.13),p('#a8adb0',[.48,.44],[.55,.38],[.84,.77],[.77,.84]),r('#a8adb0',.63,.65,.14,.05),r('#a8adb0',.70,.74,.14,.05)];
 case'bag':return[e(ink,.5,.24,.25,.21),e(cream,.5,.24,.16,.13),r(orange,.1,.31,.8,.57),r('#995c49',.12,.80,.76,.09),r(cream,.46,.50,.08,.09)];
 case'backpack':return[e(ink,.5,.10,.11,.08),r(orange,.18,.13,.64,.79),e(orange,.5,.13,.32,.08),r('#9b604b',.23,.57,.54,.30),r(cream,.24,.60,.52,.02),r('#9b604b',.23,.22,.05,.24),r('#9b604b',.72,.22,.05,.24)];
 case'folder':return[p(orange,[.08,.2],[.08,.10],[.4,.10],[.46,.2],[.92,.2],[.86,.90],[.12,.90]),r('#d3a07e',.1,.27,.8,.60),r(cream,.29,.41,.4,.15)];
 case'table':return[r(ink,.10,.33,.045,.61),r(ink,.84,.33,.045,.61),r('#b38d6d',.02,.25,.96,.08),r('#85674f',.02,.33,.96,.03)];
 case'chair':return[r(ink,.24,.5,.04,.44),r(ink,.72,.5,.04,.44),r(blue,.17,.06,.66,.46),r(blue,.16,.53,.68,.08),r(ink,.22,.47,.045,.08),r(ink,.74,.47,.045,.08)];
 case'sofa':return[r(ink,.15,.79,.04,.13),r(ink,.81,.79,.04,.13),r('#9f7972',.10,.28,.80,.38),r('#c2a299',.14,.50,.72,.27),r('#9f7972',.02,.47,.13,.32),r('#9f7972',.85,.47,.13,.32),r('#8b6d64',.50,.5,.009,.24)];
 case'board':return[r(ink,.14,.06,.72,.68),r(cream,.18,.10,.64,.60),r(ink,.23,.74,.045,.21),r(ink,.74,.74,.045,.21),r(blue,.25,.22,.5,.025),r(blue,.25,.28,.38,.02),p(orange,[.29,.58],[.40,.42],[.52,.49],[.66,.34])];
 default:throw Error('Rekvisiitta puuttuu: '+id);
}}
export function propSvg(id:string){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="256" height="256">${propShapes(id).map(s=>s.rect?`<rect fill="${s.fill}" x="${s.rect[0]}" y="${s.rect[1]}" width="${s.rect[2]}" height="${s.rect[3]}"/>`:s.ellipse?`<ellipse fill="${s.fill}" cx="${s.ellipse[0]}" cy="${s.ellipse[1]}" rx="${s.ellipse[2]}" ry="${s.ellipse[3]}"/>`:`<polygon fill="${s.fill}" points="${s.points!.map(v=>v.join(',')).join(' ')}"/>`).join('')}</svg>`;}
export type PropInstance={id:string;asset:string;x:number;y:number;scale:number;start:number;end:number};
export function drawProps(ctx:CanvasRenderingContext2D,items:PropInstance[],time:number,width:number,height:number){for(const item of items){if(time<item.start||time>=item.end)continue;const size=Math.min(width,height)*item.scale;ctx.save();ctx.translate(item.x*width-size/2,item.y*height-size/2);ctx.scale(size,size);for(const s of propShapes(item.asset)){ctx.fillStyle=s.fill;if(s.rect)ctx.fillRect(...s.rect as [number,number,number,number]);else if(s.ellipse){ctx.beginPath();ctx.ellipse(...s.ellipse as [number,number,number,number],0,0,Math.PI*2);ctx.fill();}else if(s.points){ctx.beginPath();s.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}}ctx.restore();}}
