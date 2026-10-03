import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
test('actual Electron entry module completes before ready is emitted (no startup deadlock)',()=>{
 const main=new URL('./main.mjs',import.meta.url).href,loader=fileURLToPath(new URL('./test-fixtures/electron-loader.mjs',import.meta.url));
 const result=spawnSync(process.execPath,['--loader',loader,'--input-type=module','-e',`const keepAlive=setInterval(()=>{},100);await import(${JSON.stringify(main)});clearInterval(keepAlive);console.log('ENTRY_MODULE_LOADED');`],{encoding:'utf8',timeout:3000,env:{...process.env,HAHMOSTUDIO_TEST_DATA_DIR:''}});
 assert.equal(result.error,undefined,'Entry module waited for ready before allowing Electron to emit ready');assert.equal(result.status,0,result.stderr);assert.ok(result.stdout.includes('ENTRY_MODULE_LOADED'));
});
