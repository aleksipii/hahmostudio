/** Builds a HAHMOSTUDIO_MODEL_PINS_FILE entry from Hugging Face metadata. Metadata only: no weight bytes are downloaded. */
export type PinFileSpec={path:string;comfyFolder:string;role:string};
export async function buildPin(repo:string,files:PinFileSpec[],fetchImpl:typeof fetch=fetch,token?:string){
 if(!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo))throw new Error('Invalid repo id.');
 const r=await fetchImpl(`https://huggingface.co/api/models/${repo}?blobs=true`,{headers:token?{Authorization:'Bearer '+token}:{}});
 if(!r.ok)throw new Error(`Hugging Face returned ${r.status} (gated repos need HF_TOKEN).`);
 const j=await r.json() as {sha?:string;siblings?:{rfilename:string;lfs?:{sha256?:string}}[]};
 if(!j.sha||!/^[0-9a-f]{40}$/.test(j.sha))throw new Error('No exact commit sha in the response.');
 return{revision:j.sha,files:files.map(f=>{const s=j.siblings?.find(x=>x.rfilename===f.path),h=s?.lfs?.sha256;if(!h||!/^[0-9a-f]{64}$/.test(h))throw new Error(`No SHA-256 for ${f.path} (not an LFS file, or the path is wrong).`);return{path:f.path,sha256:h,comfyFolder:f.comfyFolder,role:f.role};})};
}
