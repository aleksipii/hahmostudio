// node --experimental-strip-types scripts/make-provision-manifest.ts <modelId> <pins.json> > manifest.json
// Refuses (non-zero exit) unless the model is PRODUCTION_SAFE: licence evidence, pinned revision and SHA-256 for every file.
import {readFileSync} from 'node:fs';
import {ModelRegistry} from '../lib/cloud-render/models.ts';
import {buildProvisionManifest} from '../lib/cloud-render/provision.ts';
import {ZERO_COST_POLICY} from '../lib/cloud-render/compute.ts';
const [id,pins]=process.argv.slice(2);
if(!id||!pins){console.error('usage: make-provision-manifest.ts <modelId> <pins.json>');process.exit(2);}
try{
 const reg=new ModelRegistry().applyPins(JSON.parse(readFileSync(pins,'utf8'))),m=reg.get(id);
 if(!m)throw new Error('Unknown model '+id);
 console.log(JSON.stringify(buildProvisionManifest(m,'PRODUCTION_SAFE',ZERO_COST_POLICY),null,1));
}catch(e){console.error('REFUSED: '+(e as Error).message);process.exit(1);}
