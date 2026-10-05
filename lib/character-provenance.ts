import type {PsdDocument} from './psd-model.ts';
import type {QuickProfile} from './quick-animation.ts';

export type CharacterProvenance={
 asset:QuickProfile['asset'];
 version:2;
 author:string;
 license:'CC0-1.0'|'unknown';
 origin:'studio-library'|'user-import';
 externalAssets:[];
 note?:string;
 views?:('front'|'right'|'left')[];
 graphics?:string;
 capabilities?:string[];
 preview?:string;
};

function isUserDerivedPack(doc:PsdDocument):boolean{
 return doc.warnings.some(w=>/Oma PSD/i.test(w));
}

/** Metadata for portable .hahmo packs; programmatic fields do not grant usage rights. */
export function characterProvenance(quick:QuickProfile,doc:PsdDocument):CharacterProvenance{
 if(isUserDerivedPack(doc)){
  return {
   asset:quick.asset,
   version:2,
   author:'user-provided',
   license:'unknown',
   origin:'user-import',
   externalAssets:[],
   note:'Tuotu tai johdettu käyttäjän omasta aineistosta. Tämä merkintä ei myönnä käyttöoikeuksia.',
  };
 }
 const base:CharacterProvenance={
  asset:quick.asset,
  version:2,
  author:'Hahmostudio',
  license:'CC0-1.0',
  origin:'studio-library',
  externalAssets:[],
 };
 const viewKeys=quick.views?Object.keys(quick.views):[];
 if(viewKeys.length>1)base.views=['front','right','left'].filter(v=>viewKeys.includes(v)) as CharacterProvenance['views'];
 if(quick.asset.includes('multiview'))base.graphics='Original front and separately drawn side profile; left mirrors side profile, not front art';
 if(quick.asset.includes('otto')){base.graphics='Original procedural raster art';base.capabilities=['volume-mouth','blink','brows','arms-up','jump'];base.preview='preview.png';}
 if(/aino|leo|hahmopohja/i.test(quick.asset))base.capabilities=['full-body','wave','walk','crouch','jump','volume-mouth'];
 return base;
}
