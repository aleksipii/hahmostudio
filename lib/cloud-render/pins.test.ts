import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildPin} from './pins.ts';
import {ModelRegistry} from './models.ts';
const sha='e'.repeat(40),h='f'.repeat(64);
const ok=(async()=>new Response(JSON.stringify({sha,siblings:[{rfilename:'a/w.safetensors',lfs:{sha256:h}},{rfilename:'config.json'}]}))) as unknown as typeof fetch;
test('pin is built from metadata and is accepted by the registry',async()=>{
 const p=await buildPin('o/r',[{path:'a/w.safetensors',comfyFolder:'checkpoints',role:'checkpoint'}],ok);assert.equal(p.revision,sha);assert.equal(p.files[0].sha256,h);
 new ModelRegistry().applyPins({'flux1-schnell':p});
});
test('pin refuses missing hashes, bad repos and failed lookups',async()=>{
 await assert.rejects(buildPin('o/r',[{path:'config.json',comfyFolder:'checkpoints',role:'checkpoint'}],ok),/No SHA-256/);
 await assert.rejects(buildPin('../x',[],ok),/Invalid repo/);
 await assert.rejects(buildPin('o/r',[],(async()=>new Response('',{status:401})) as unknown as typeof fetch),/gated/);
});
