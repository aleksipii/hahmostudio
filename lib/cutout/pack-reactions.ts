import type {Actor} from './model.ts';

/** Cutout reaction clips validated per paper pack (shared Kille/Handu rig). */
export type CutoutReactionId='REACT_NOD'|'REACT_SURPRISE'|'REACT_WAVE';

export const cutoutReactionsByPack:Record<Actor['asset'],CutoutReactionId[]>={
 Kille:['REACT_NOD','REACT_SURPRISE','REACT_WAVE'],
 'Mr.Kille':['REACT_NOD','REACT_SURPRISE','REACT_WAVE'],
 'Mr.Handu':['REACT_NOD','REACT_SURPRISE','REACT_WAVE'],
};

export const presentationReaction:Record<string,CutoutReactionId>={
 'react-nod':'REACT_NOD',
 'react-surprise':'REACT_SURPRISE',
 'react-wave':'REACT_WAVE',
};

export function packSupportsReaction(pack:Actor['asset'],reaction:CutoutReactionId){
 return cutoutReactionsByPack[pack]?.includes(reaction)??false;
}
