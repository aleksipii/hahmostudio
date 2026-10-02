import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
await mkdir('public/vision',{recursive:true});
for(const name of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm'])await copyFile(`node_modules/@mediapipe/tasks-vision/wasm/${name}`,`public/vision/${name}`);
await copyFile('node_modules/@mediapipe/tasks-vision/vision_bundle.cjs','public/vision/vision_bundle.js');
const path='public/vision/face_landmarker.task',expected='64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff';let bytes;try{bytes=await readFile(path);}catch{}
if(!bytes||createHash('sha256').update(bytes).digest('hex')!==expected){const response=await fetch('https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task');if(!response.ok)throw Error('Kasvomallin lataus epäonnistui.');bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Kasvomallin tarkistussumma ei täsmää.');await writeFile(path,bytes);}
console.log('Paikallisen kasvomallin aineistot valmiina.');
