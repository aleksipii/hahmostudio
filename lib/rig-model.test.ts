import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRig, readRig } from './rig-model.ts';
import type { PsdDocument } from './psd-model.ts';
const doc: PsdDocument = { name: 'test.psd', width: 640, height: 480, size: 0, warnings: [], layers: [{ key: '0', psdId: 7, name: 'Head', path: 'Head', kind: 'layer', left: 100, top: 50, width: 80, height: 100, opacity: 1, visible: true, blendMode: 'normal', children: [], warnings: [] }] };
test('round trip preserves role and document-space pivot and joints', () => {
 const rig = createRig(doc); rig.parts[0].role = 'head'; rig.parts[0].pivot = { x: 110, y: 90 }; rig.parts[0].joints = [{ x: 100, y: 150 }];
 assert.deepEqual(readRig(JSON.stringify(rig), doc), rig);
});
test('stable PSD ID reconnects after hierarchy key changes', () => {
 const rig = createRig(doc); rig.parts[0].key = 'old'; rig.parts[0].path = 'old';
 assert.equal(readRig(JSON.stringify(rig), doc).parts[0].key, '0');
});
test('invalid imports fail without mutating existing rig', () => {
 for (const modify of [
  (r: any) => r.source.width++, (r: any) => r.parts[0].psdId = 99,
  (r: any) => r.parts.push(r.parts[0]), (r: any) => r.parts[0].role = '__proto__',
  (r: any) => r.parts[0].pivot.x = -1, (r: any) => r.parts[0].joints = Array(33).fill({x: 0,y: 0}),
 ]) {
  const rig = createRig(doc); modify(rig); assert.throws(() => readRig(JSON.stringify(rig), doc));
  assert.equal(doc.layers[0].left, 100);
 }
});
test('ID-less layers require matching hierarchy and path', () => {
 const original = structuredClone(doc); delete original.layers[0].psdId;
 const rig = createRig(original); assert.deepEqual(readRig(JSON.stringify(rig), original), rig);
 rig.parts[0].path = 'Other'; assert.throws(() => readRig(JSON.stringify(rig), original));
});
