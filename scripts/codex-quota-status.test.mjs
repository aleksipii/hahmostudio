import test from 'node:test';
import assert from 'node:assert/strict';
import {quotaStatus,readCodexQuota} from './codex-quota-status.mjs';

test('10 percent remaining uses the actual primary window, not percent spent or weekly usage',()=>{
 const result={rateLimitsByLimitId:{codex:{limitId:'codex',primary:{usedPercent:29,windowDurationMins:300},secondary:{usedPercent:95,windowDurationMins:10080}}}};
 assert.equal(quotaStatus(result).checkpointRecommended,false);
 assert.equal(quotaStatus(result).windows[0].remainingPercent,71);
 assert.equal(quotaStatus(result,{anyWindow:true}).checkpointRecommended,true);
 result.rateLimitsByLimitId.codex.primary.usedPercent=90;
 assert.equal(quotaStatus(result).checkpointRecommended,true);
});

test('missing or malformed quota is unknown and never triggers a checkpoint',()=>{
 for(const result of [null,{}, {rateLimits:null},{rateLimits:{primary:{usedPercent:'90'}}},{rateLimits:{primary:{usedPercent:-1}}}]){
  assert.equal(quotaStatus(result).available,false);
  assert.equal(quotaStatus(result).checkpointRecommended,false);
 }
 assert.equal(quotaStatus({rateLimits:{limitId:'codex',primary:{usedPercent:100,windowDurationMins:300}}}).checkpointRecommended,true);
});

test('unavailable app-server reports failure without making model or Git calls',async()=>{
 const result=await readCodexQuota({binary:'/nonexistent/hahmostudio-codex-test',timeoutMs:100});
 assert.equal(result.available,false);assert.equal(result.checkpointRecommended,false);
});

test('a different primary window never substitutes for the owner-selected five-hour window',()=>{
 const result=quotaStatus({rateLimits:{primary:{usedPercent:99,windowDurationMins:60}}});
 assert.equal(result.available,true);assert.equal(result.selectedWindowAvailable,false);assert.equal(result.checkpointRecommended,false);
});
