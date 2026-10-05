import {writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {once} from 'node:events';
import {grammarCoverage,generateSentences,parseRuleScript} from '../lib/script-grammar.ts';
const report=grammarCoverage();console.log(JSON.stringify(report,null,2));
await writeFile('docs/grammar-coverage.json',JSON.stringify(report,null,2)+'\n');
if(process.argv.includes('--list')){const out=createWriteStream('/private/tmp/kilsat-covered-sentences.txt');let count=0;for(const sentence of generateSentences()){if(!out.write(sentence+'\n'))await once(out,'drain');count++;}out.end();await once(out,'finish');console.log('Listattu '+count+' lauseasua: /private/tmp/kilsat-covered-sentences.txt');}

if(process.argv.includes('--verify')){let count=0,unknown=0;const started=performance.now();for(const sentence of generateSentences()){const actor=sentence.split(' ')[0],parsed=parseRuleScript('Hahmo: '+actor+'\n'+sentence);if(parsed.diagnostics.length || parsed.commands.length!==1)unknown++;count++;}const verified={...report,verifiedSentences:count,unknownSentences:unknown,recognitionPercent:(count-unknown)/count*100,milliseconds:performance.now()-started};await writeFile('docs/grammar-coverage.json',JSON.stringify(verified,null,2)+'\n');console.log(JSON.stringify(verified));if(unknown)process.exitCode=1;}
