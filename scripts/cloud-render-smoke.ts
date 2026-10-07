// Usage (operator, with the same env as the server): node --experimental-strip-types scripts/cloud-render-smoke.ts
import {createCloudRender} from '../lib/cloud-render/server.ts';
import {smokeCheck} from '../lib/cloud-render/smoke.ts';
const c=createCloudRender(process.env,'.private-storage'),b=c.backends.get('colab-free');
if(!b){console.error('No colab-free backend.');process.exit(2);}
const r=await smokeCheck(b,c.models,c.workflows,c.policy,c.modelMode);
if(!r.authorized){console.error('BLOCKED:\n'+r.reasons.join('\n'));process.exit(1);}
for(const x of r.rows)console.log(`${x.ok?'OK  ':'FAIL'} ${x.workflowId} / ${x.modelId}${x.problems.length?'\n     '+x.problems.join('\n     '):''}`);
process.exit(r.rows.some(x=>x.ok)?0:1);
