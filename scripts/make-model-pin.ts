// node --experimental-strip-types scripts/make-model-pin.ts <modelId> <hf-repo> <path>=<comfyFolder>:<role> ... > pins.json
// Merges into the file named by PINS_OUT (default: stdout-only). Review the output before use; the commit is whatever "main" is today.
import {buildPin} from '../lib/cloud-render/pins.ts';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const [id,repo,...specs]=process.argv.slice(2);
if(!id||!repo||!specs.length){console.error('usage: make-model-pin.ts <modelId> <repo> <path>=<folder>:<role>...');process.exit(2);}
const files=specs.map(s=>{const m=/^(.+)=([a-z_]+):([a-z0-9_]+)$/.exec(s);if(!m)throw new Error('bad spec '+s);return{path:m[1],comfyFolder:m[2],role:m[3]};});
const pin=await buildPin(repo,files,fetch,process.env.HF_TOKEN),out=process.env.PINS_OUT,all=out&&existsSync(out)?JSON.parse(readFileSync(out,'utf8')):{};all[id]=pin;
const text=JSON.stringify(all,null,1);if(out)writeFileSync(out,text);else console.log(text);
