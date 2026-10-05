import {sampleBezierCurve,validateBezierCurve,type BezierCurve} from './easing-model.ts';
import {deserializeStateMachine,type StateMachine} from './state-machine-model.ts';
import type { PsdDocument } from './psd-model.ts';
import { readRig, validateRig, type Rig } from './rig-model.ts';
export type Pose = { x: number; y: number; rotation: number; scale: number; opacity: number };
export type Keyframe = Pose & { frame: number; easing: 'linear' | 'smooth' | 'hold'; bezierCurve?: BezierCurve };
export type Track = { key: string; frames: Keyframe[] };
export type Animation = { format: 'hahmostudio-animation'; version: 1; fps: number; duration: number; rig: Rig; tracks: Track[]; stateMachine?: StateMachine };
export const neutral: Pose = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };
export function createAnimation(rig: Rig): Animation { return { format: 'hahmostudio-animation', version: 1, fps: 24, duration: 120, rig, tracks: [] }; }
export function sampleTrack(track: Track | undefined, frame: number): Pose {
 if (!track?.frames.length) return { ...neutral };
 const frames = track.frames;
 if (frame <= frames[0].frame) return { ...frames[0] };
 const last = frames.at(-1)!;
 if (frame >= last.frame) return { ...last };
 const right = frames.findIndex(k => k.frame > frame), a = frames[right - 1], b = frames[right];
 let t = (frame - a.frame) / (b.frame - a.frame);
 if (a.easing === 'hold') t = 0;
 if (a.easing !== 'hold' && a.bezierCurve) t = sampleBezierCurve(a.bezierCurve,t);
 else if (a.easing === 'smooth') t = t * t * (3 - 2 * t);
 return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, rotation: a.rotation + (b.rotation - a.rotation) * t, scale: a.scale + (b.scale - a.scale) * t, opacity: a.opacity + (b.opacity - a.opacity) * t };
}
export function putKeyframe(animation: Animation, key: string, frame: Keyframe): Animation {
 const track = animation.tracks.find(t => t.key === key);
 const frames = [...(track?.frames.filter(k => k.frame !== frame.frame) ?? []), { ...frame }].sort((a,b) => a.frame - b.frame);
 return { ...animation, tracks: [...animation.tracks.filter(t => t.key !== key), { key, frames }] };
}
export function removeKeyframe(animation: Animation, key: string, frame: number): Animation {
 return { ...animation, tracks: animation.tracks.map(t => t.key === key ? { ...t, frames: t.frames.filter(k => k.frame !== frame) } : t).filter(t => t.frames.length) };
}
export function readAnimation(text: string, doc: PsdDocument): Animation {return validateAnimation(JSON.parse(text),doc);}
export function validateAnimation(value:unknown,doc:PsdDocument):Animation {
 const a = value as any;
 if (!a || a.format !== 'hahmostudio-animation' || a.version !== 1 || !Number.isInteger(a.fps) || a.fps < 1 || a.fps > 60 || !Number.isInteger(a.duration) || a.duration < 2 || a.duration > 72000 || !Array.isArray(a.tracks) || a.tracks.length > 1000) throw new Error('Animaatiotiedoston asetukset ovat virheelliset.');
 const rig = validateRig(a.rig, doc), used = new Set<string>(); let total = 0;
 const tracks = a.tracks.map((t: Track) => {
  if (!t || !Array.isArray(t.frames)) throw new Error('Animaation rata on virheellinen.');
  const oldPart = a.rig.parts.find((p: {key: string}) => p.key === t.key);
  const matches = rig.parts.filter(p => oldPart && (oldPart.psdId !== undefined ? p.psdId === oldPart.psdId : p.key === oldPart.key && p.path === oldPart.path));
  if (matches.length !== 1 || used.has(matches[0].key)) throw new Error('Animaation tasoa ei löydy tästä PSD:stä.');
  used.add(matches[0].key); total += t.frames.length;
  if (total > 10000) throw new Error('Animaatiossa on liian monta avainruutua.');
  const seen = new Set<number>();
  const frames = t.frames.map(k => {
   if (!k || !Number.isInteger(k.frame) || k.frame < 0 || k.frame >= a.duration || seen.has(k.frame) || !['linear','smooth','hold'].includes(k.easing) || !['x','y','rotation','scale','opacity'].every(v => typeof k[v as keyof Pose] === 'number' && Number.isFinite(k[v as keyof Pose])) || Math.abs(k.x) > doc.width * 4 || Math.abs(k.y) > doc.height * 4 || Math.abs(k.rotation) > 3600 || k.scale < .01 || k.scale > 10 || k.opacity < 0 || k.opacity > 1) throw new Error('Avainruudun tiedot ovat virheelliset.');
   if (k.bezierCurve && validateBezierCurve(k.bezierCurve).length) throw Error('Avainruudun Bézier-käyrä on virheellinen.');
   seen.add(k.frame); return { frame: k.frame, x: k.x, y: k.y, rotation: k.rotation, scale: k.scale, opacity: k.opacity, easing: k.easing, ...(k.bezierCurve?{bezierCurve:{cp1:{...k.bezierCurve.cp1},cp2:{...k.bezierCurve.cp2}}}:{}) };
  }).sort((a,b) => a.frame - b.frame);
  return { key: matches[0].key, frames };
 });
 return { format:'hahmostudio-animation', version:1, fps:a.fps, duration:a.duration, rig, tracks, ...(a.stateMachine?{stateMachine:deserializeStateMachine(JSON.stringify(a.stateMachine))}:{}) };
}
