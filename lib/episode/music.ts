import {cleanLine} from '../script-recognizer.ts';

/* ───────────────────────── Ääni ───────────────────────── */

export const musicMoods=['iloinen','jännittävä','rauhallinen','surullinen'] as const;
export type MusicMood=typeof musicMoods[number];
const moodWords:[RegExp,MusicMood][]=[[/^(iloi\p{L}*|happy|cheerful|upbeat|reipas|pirteä)$/u,'iloinen'],[/^(jännit\p{L}*|tense|suspense\p{L}*|exciting|dramaattinen|dramatic)$/u,'jännittävä'],[/^(rauhalli\p{L}*|calm|peaceful|relaxed|chill|levollinen)$/u,'rauhallinen'],[/^(surulli\p{L}*|sad|melancholic|melankolinen|haikea)$/u,'surullinen']];
export type MusicCue={mood?:MusicMood;file?:string;off?:boolean;line:number;text:string};
/** `Musiikki: rauhallinen`, `Music: tense`, `Musiikki: tiedosto.wav`, `Musiikki: pois`. */
export function parseMusicLine(text:string):Omit<MusicCue,'line'>|undefined{
 const m=cleanLine(text).match(/^(?:Musiikki|Taustamusiikki|Music|Background music)\s*:\s*(.+)$/i);if(!m)return;const v=m[1].trim();
 if(/^(pois|ei|off|none|stop|loppuu)$/i.test(v))return{off:true,text:v};
 if(/^[\w.-]{1,100}\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(v))return{file:v,text:v};
 const mood=v.toLocaleLowerCase('fi-FI').split(/[\s,]+/).map(w=>moodWords.find(([re])=>re.test(w))?.[1]).find(Boolean);
 return{mood,text:v};
}
