/** Original vector scenery shared by preview, PNG/MP4 rendering and downloadable SVGs. */
export const backgrounds=[
 {id:'studio-v1',name:'Studio',hint:'Suora kuvakulma'},
 {id:'phone-front-v1',name:'Puhelin · edestä',hint:'Hahmo puhelimen näytössä'},
 {id:'phone-angle-v1',name:'Puhelin · sivuviisto',hint:'Puhelin pöydällä'},
 {id:'car-driver-v1',name:'Auto · kuljettaja',hint:'Kamera tuulilasilla'},
 {id:'car-passenger-v1',name:'Auto · matkustaja',hint:'Kamera sivuikkunalla'},
 {id:'car-back-v1',name:'Auto · takapenkiltä',hint:'Kamera takana, näkymä eteen'}
] as const;
export type BackgroundId=typeof backgrounds[number]['id'];
export type Shape={fill:string;points?:number[][];rect?:number[];ellipse?:number[];gradient?:[string,string]};
export function backgroundShapes(id:BackgroundId):Shape[]{
 const r=(fill:string,...rect:number[]):Shape=>({fill,rect}),p=(fill:string,...points:number[][]):Shape=>({fill,points}),e=(fill:string,...ellipse:number[]):Shape=>({fill,ellipse});
 if(id==='studio-v1')return [{...r('#172b43',0,0,1,1),gradient:['#172b43','#405574']},r('#607392',.12,.18,.76,.62),r('#34465f',0,.8,1,.2),r('#8192ac',.12,.18,.76,.003*1080/1920)];
 if(id==='phone-front-v1')return [r('#dde8f0',0,0,1,1),r('#b8c9d7',0,.88,1,.12),r('#101e31',.07,.02,.86,.96),r('#7192af',.10,.06,.80,.86),r('#22384f',.34,.03,.32,.025),e('#dde8f0',.5,.948,.028,.016)];
 if(id==='phone-angle-v1')return [r('#efe4d3',0,0,1,1),p('#c4ad8c',[0,.77],[1,.6],[1,1],[0,1]),p('#5d687b',[.06,.10],[.76,.02],[.98,.87],[.20,.98]),p('#13233a',[.06,.09],[.72,.02],[.94,.84],[.18,.96]),p('#7398b6',[.10,.15],[.68,.08],[.88,.77],[.22,.88]),p('#243b53',[.34,.11],[.51,.09],[.52,.11],[.34,.13]),e('#d6e4ee',.53,.85,.034,.015)];
 const road=[r('#b5d5e9',0,0,1,1),r('#85ac79',0,.32,1,.24),p('#52616e',[.37,.30],[.63,.30],[.98,.72],[.02,.72]),p('#fff3cb',[.49,.32],[.51,.32],[.55,.64],[.45,.64])];
 if(id==='car-driver-v1')return [...road,p('#202d3f',[0,0],[.1,0],[.18,.55],[0,.76]),p('#202d3f',[.9,0],[1,0],[1,.76],[.82,.55]),r('#24364c',0,0,1,.10),r('#223448',0,.68,1,.32),r('#596d80',0,.68,1,.05),r('#142333',.12,.77,.34,.12),e('#101b2b',.74,.81,.21,.12),e('#5b6c7b',.74,.81,.14,.074),r('#0b1a2b',.55,.97,.42,.03)];
 if(id==='car-passenger-v1')return [...road,p('#202d3f',[0,0],[1,0],[1,.12],[.23,.12],[.06,.62],[0,.62]),p('#3c5068',[0,.57],[1,.43],[1,.71],[0,.9]),r('#24354a',0,.83,1,.17),p('#18263a',[.73,.12],[.87,.12],[1,.59],[.9,.60]),e('#162439',.19,.71,.20,.08),e('#78899b',.19,.71,.14,.05),r('#162437',.72,.72,.20,.25)];
 return [...road,r('#1e3046',0,0,1,.12),p('#20334b',[0,0],[.12,0],[.24,.56],[0,.80]),p('#20334b',[.88,0],[1,0],[1,.80],[.76,.56]),r('#334b66',0,.64,1,.36),r('#18293e',.02,.47,.29,.50),r('#18293e',.69,.47,.29,.50),r('#617a94',.065,.43,.20,.15),r('#617a94',.735,.43,.20,.15),r('#18293e',.40,.78,.20,.22)];
}
export function drawBackground(ctx:CanvasRenderingContext2D,id:BackgroundId,w:number,h:number){ctx.save();ctx.scale(w,h);for(const s of backgroundShapes(id)){ctx.fillStyle=s.fill;if(s.gradient){const g=ctx.createLinearGradient(0,0,0,1);g.addColorStop(0,s.gradient[0]);g.addColorStop(1,s.gradient[1]);ctx.fillStyle=g;}if(s.rect)ctx.fillRect(...s.rect as [number,number,number,number]);else if(s.ellipse){ctx.beginPath();ctx.ellipse(...s.ellipse as [number,number,number,number],0,0,Math.PI*2);ctx.fill();}else if(s.points){ctx.beginPath();s.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}}ctx.restore();}
export function backgroundSvg(id:BackgroundId,w=1080,h=1920){const shapes=backgroundShapes(id).map((s,i)=>s.rect?`<rect x="${s.rect[0]}" y="${s.rect[1]}" width="${s.rect[2]}" height="${s.rect[3]}" fill="${s.gradient?'url(#g'+i+')':s.fill}"/>`:s.ellipse?`<ellipse cx="${s.ellipse[0]}" cy="${s.ellipse[1]}" rx="${s.ellipse[2]}" ry="${s.ellipse[3]}" fill="${s.fill}"/>`:`<polygon points="${s.points!.map(p=>p.join(',')).join(' ')}" fill="${s.fill}"/>`).join('');return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1 1" preserveAspectRatio="none">${backgroundShapes(id).map((s,i)=>s.gradient?`<defs><linearGradient id="g${i}" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${s.gradient[0]}"/><stop offset="1" stop-color="${s.gradient[1]}"/></linearGradient></defs>`:'').join('')}${shapes}</svg>`;}
