// Linux dry run of package-mac.mjs staging + packager for darwin/arm64, no signing, no native/Kokoro resources.
import {createRequire} from 'node:module';import {mkdtemp,mkdir,cp,writeFile,rm,readFile} from 'node:fs/promises';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';
const root=process.cwd(),req=createRequire(root+'/package.json');const {packager}=await import(req.resolve('@electron/packager'));
const src=await readFile(resolve('scripts/package-mac.mjs'),'utf8');const {readdir}=await import('node:fs/promises');const docNames=['THIRD_PARTY_NOTICES.md','README.md',...(await readdir(root)).filter(n=>/^DEVELOPMENT-.+\.md$/.test(n)),'CHANGELOG.md','docs'];
const stage=await mkdtemp(join(tmpdir(),'hs-stage-')),meta=JSON.parse(await readFile('package.json','utf8'));
for(const d of ['desktop','server','dist-desktop','licenses'])await cp(resolve(d),join(stage,d),{recursive:true,filter:p=>!p.endsWith('.test.mjs')&&!p.includes('test-fixtures')});
for(const d of ['lib/cloud-render','cloud/runtime'])await cp(resolve(d),join(stage,d),{recursive:true,filter:p=>!/\.test\.(ts|mjs)$/.test(p)&&!p.includes('test-fixtures')&&!p.includes('__pycache__')});
await mkdir(join(stage,'lib/studio'),{recursive:true});await cp(resolve('lib/studio/hash.ts'),join(stage,'lib/studio/hash.ts'));
await writeFile(join(stage,'package.json'),JSON.stringify({name:meta.name,version:meta.version,main:meta.main,type:'module',private:true}));
for(const n of docNames){try{await cp(resolve(n),join(stage,n),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}}
const out=process.argv[2];
const paths=await packager({dir:stage,name:'KOETA',appBundleId:'fi.hahmostudio.desktop',appVersion:meta.version,platform:'darwin',arch:'arm64',electronVersion:meta.devDependencies.electron,out,overwrite:true,asar:true,prune:false,icon:resolve('desktop/assets/Hahmostudio.icns')});
console.log(paths);await rm(stage,{recursive:true,force:true});
