import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {parsePresentation} from '../presentation-parser.ts';
import {canonicalFromPresentation} from './canonical-adapter.ts';
import {validateSuggestion} from './ai-validator.ts';
import {lockScene} from './scene-lock.ts';

const p=parsePresentation(readFileSync(new URL('../../public/library/KILSAT-S01E01.md',import.meta.url),'utf8'));
test('Presentation projects into valid canonical state without being modified',()=>{
 const before=JSON.stringify(p),c=canonicalFromPresentation(p,{characters:{KILLE:{attributes:{hair:'brown'}}}});
 assert.equal(JSON.stringify(p),before);
 assert.deepEqual(Object.values(c.characters).map(x=>x.name).sort(),[...p.characters].sort());
 assert.equal(c.characters.kille.attributes.hair,'brown');assert.deepEqual(c.characters.handu.attributes,{},'unsupplied attributes do not exist (closed world)');
 assert.ok(Object.keys(c.scenes).length>=1);
});
test('the same canonical state drives validation: an invented character or attribute is rejected',async()=>{
 const c=canonicalFromPresentation(p,{characters:{KILLE:{attributes:{hair:'brown'}}}}),sid=Object.keys(c.scenes)[0],sc=c.scenes[sid];
 const base={sceneId:sid,camera:{shot:'medium',movement:'static'},characterActions:[],environment:{location:sc.locationId},lighting:{style:'neutral'},visualStyle:{style:'cartoon'},promptFragments:[]};
 assert.equal(validateSuggestion(c,sid,base).status,'APPROVED');
 assert.equal(validateSuggestion(c,sid,{...base,characterActions:[{id:'bob',action:'speak'}]}).status,'REJECTED');
 assert.equal(validateSuggestion(c,sid,{...base,characterActions:[{id:sc.characterIds[0],action:'speak',claims:{hair:'blonde'}}]}).status,'REJECTED');
 assert.ok((await lockScene(c,sid,'t')).hash);
});
