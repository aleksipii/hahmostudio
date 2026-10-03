import fs from 'node:fs';import {backgrounds,backgroundSvg,backgroundShapes} from '../lib/backgrounds.ts';
fs.mkdirSync('.character-build',{recursive:true});for(const b of backgrounds)fs.writeFileSync('public/library/'+b.id+'.svg',backgroundSvg(b.id));fs.writeFileSync('.character-build/backgrounds.json',JSON.stringify(backgrounds.map(b=>({...b,shapes:backgroundShapes(b.id)}))));
