import { flatten, type PsdDocument, type LayerNode } from './psd-model.ts';
export const roles = { none: 'Ei roolia', head: 'Pää', body: 'Vartalo', arm: 'Käsi', hand: 'Kämmen', leg: 'Jalka', foot: 'Jalkaterä', eye: 'Silmä', mouth: 'Suu', accessory: 'Muu osa' } as const;
export type Point = { x: number; y: number };
export type RigPart = { key: string; psdId?: number; path: string; role: keyof typeof roles; pivot: Point; joints: Point[]; parentKey?: string };
export type Rig = { format: 'hahmostudio-rig'; version: 1; source: { name: string; width: number; height: number }; parts: RigPart[] };
export function defaultPart(n: LayerNode): RigPart { return { key: n.key, psdId: n.psdId, path: n.path, role: 'none', pivot: { x: n.left + n.width / 2, y: n.top + n.height / 2 }, joints: [] }; }
export function createRig(doc: PsdDocument): Rig { return { format: 'hahmostudio-rig', version: 1, source: { name: doc.name, width: doc.width, height: doc.height }, parts: flatten(doc.layers).filter(n => n.kind === 'layer').map(n => { const p = defaultPart(n); p.pivot.x = Math.max(0, Math.min(doc.width, p.pivot.x)); p.pivot.y = Math.max(0, Math.min(doc.height, p.pivot.y)); return p; }) }; }
export function readRig(text: string, doc: PsdDocument): Rig {return validateRig(JSON.parse(text),doc);}
export function validateRig(value:unknown,doc:PsdDocument):Rig {
 const data = value as any;
 if (!data || data.format !== 'hahmostudio-rig' || data.version !== 1 || data.source?.width !== doc.width || data.source?.height !== doc.height || !Array.isArray(data.parts) || data.parts.length > 1000) throw new Error('Nivelmäärityksen versio tai kuvan koko ei vastaa avattua PSD:tä.');
 const rig = createRig(doc), used = new Set<string>(), remap = new Map<string,string>();
 const point = (p: unknown): Point => {
  if (!p || typeof p !== 'object' || !('x' in p) || !('y' in p) || typeof p.x !== 'number' || typeof p.y !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x > doc.width || p.y > doc.height) throw new Error('Nivelmäärityksen pisteiden pitää olla kuvan sisällä.');
  return { x: p.x, y: p.y };
 };
 for (const part of data.parts) {
  if (!part || typeof part.role !== 'string' || !Object.hasOwn(roles, part.role) || !Array.isArray(part.joints) || part.joints.length > 32) throw new Error('Nivelmäärityksen osan tiedot ovat virheelliset.');
  // Match stable PSD IDs first; without an ID require both hierarchy key and path.
  const matches = rig.parts.filter(n => part.psdId !== undefined ? n.psdId === part.psdId : n.key === part.key && n.path === part.path);
  if (matches.length !== 1 || used.has(matches[0].key)) throw new Error('Nivelmäärityksen tasoja ei voi yhdistää tähän PSD:hen yksiselitteisesti. Avaa alkuperäinen PSD.');
  const target = matches[0]; used.add(target.key); if(typeof part.key!=='string'||remap.has(part.key)) throw new Error('Nivelmäärityksen tunniste on virheellinen.'); remap.set(part.key,target.key); target.role = part.role as keyof typeof roles; target.pivot = point(part.pivot); target.joints = part.joints.map(point);
 }
 for (const saved of data.parts) {
  if(saved.parentKey === undefined) continue;
  if(typeof saved.parentKey !== 'string' || !remap.has(saved.parentKey)) throw new Error('Osan liitoskohdetta ei löydy nivelmäärityksestä.');
  rig.parts.find(p=>p.key===remap.get(saved.key))!.parentKey=remap.get(saved.parentKey);
 }
 for(const p of rig.parts) rigChain(rig,p.key);
 return rig;
}
// Root first. Imported and edited connections must be acyclic.
export function rigChain(rig: Rig, key: string): RigPart[] {
 const byKey=new Map(rig.parts.map(p=>[p.key,p])), seen=new Set<string>(), chain:RigPart[]=[];
 let part=byKey.get(key);
 while(part){if(seen.has(part.key))throw new Error('Osien liitoksissa on kehä.');seen.add(part.key);chain.unshift(part);if(part.parentKey&&!byKey.has(part.parentKey))throw new Error('Osan liitoskohdetta ei löydy.');part=part.parentKey?byKey.get(part.parentKey):undefined;}
 return chain;
}
export function canAttach(rig: Rig, key:string, parentKey:string):boolean {
 if(key===parentKey)return false;
 return !rigChain(rig,parentKey).some(p=>p.key===key);
}
