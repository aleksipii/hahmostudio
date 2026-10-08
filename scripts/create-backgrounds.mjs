import fs from 'node:fs';import {backgrounds,backgroundSvg,backgroundShapes} from '../lib/backgrounds.ts';import {propLibrary,propSvg} from '../lib/prop-library.ts';
fs.mkdirSync('.character-build',{recursive:true});for(const b of backgrounds)fs.writeFileSync('public/library/'+b.id+'.svg',backgroundSvg(b.id));fs.writeFileSync('.character-build/backgrounds.json',JSON.stringify(backgrounds.map(b=>({...b,shapes:backgroundShapes(b.id)}))));
for(const p of propLibrary)fs.writeFileSync('public/library/'+p.id+'.svg',propSvg(p.id));
