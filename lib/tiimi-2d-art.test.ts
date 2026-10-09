import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeCanvas, readPsd, type Layer} from 'ag-psd';
import {unzipSync, strFromU8} from 'fflate';

initializeCanvas(() => {throw new Error('Asset regression must not require a browser canvas');},
  (width, height) => ({width, height, data: new Uint8ClampedArray(width * height * 4)}) as unknown as ImageData);

const colors = {
  Pipsa: {shirt: [242,194,48], pants: [47,111,143]},
  Ville: {shirt: [184,106,42], pants: [44,58,90]},
  Taru: {shirt: [239,122,54], pants: [78,111,160]},
  Ukko: {shirt: [143,164,138], pants: [110,88,69]},
};
function pixel(layer: Layer, x: number, y: number) {
  const image = layer.imageData!;
  assert.ok(x >= layer.left! && y >= layer.top! && x < layer.right! && y < layer.bottom!);
  const at = ((y - layer.top!) * image.width + x - layer.left!) * 4;
  return Array.from(image.data.slice(at, at + 4));
}

for (const [name, palette] of Object.entries(colors)) {
  test(`${name}: shipped 2D and multiview limbs retain flat colors and portable joint IDs`, () => {
    for (const suffix of ['', '-3D']) {
      const stem = new URL(`../public/library/${name}${suffix}`, import.meta.url);
      const bytes = readFileSync(new URL(stem.href + '.psd'));
      const archive = unzipSync(readFileSync(new URL(stem.href + '.hahmo')));
      assert.deepEqual(archive['source/character.psd'], new Uint8Array(bytes));
      const project = JSON.parse(strFromU8(archive['project.json']));
      const psd = readPsd(bytes, {useImageData:true, skipCompositeImageData:true, skipThumbnail:true});
      const views = suffix ? psd.children!.map(v => v.children!) : [psd.children!];
      assert.equal(views.length, suffix ? 4 : 1);
      const parts = project.animation.rig.parts as Array<{key:string;psdId:number;parentKey?:string;pivot:{x:number;y:number};joints:Array<{x:number;y:number}>}>;
      const byId = new Map(parts.map(p => [p.psdId, p]));
      assert.equal(byId.size, parts.length, 'stable PSD IDs must be unique');
      for (const groups of views) {
        const body = groups.find(g => g.name === 'Vartalo')!.children!;
        const torso = body.find(l => l.name === 'Vartalo')!;
        for (const layer of body.filter(l => /reisi|sääri|olkavarsi|kyynärvarsi/.test(l.name!))) {
          const expected = /reisi|sääri/.test(layer.name!) ? palette.pants : palette.shirt;
          const part = byId.get(layer.id!)!;
          assert.ok(part, `${layer.name}: rig mapping exists`);
          assert.ok(parts.some(p => p.key === part.parentKey), `${layer.name}: attachment exists`);
          assert.deepEqual(pixel(layer, part.pivot.x, part.pivot.y), [...expected,255], `${layer.name}: filled rotation joint`);
          for (const joint of part.joints) assert.deepEqual(pixel(layer,joint.x,joint.y),[...expected,255], `${layer.name}: filled distal joint`);
          const image = layer.imageData!;
          let opaque = 0, base = 0;
          for (let i=0;i<image.data.length;i+=4) if (image.data[i+3]===255) {
            opaque++;
            if (expected.every((c,j)=>image.data[i+j]===c)) base++;
          }
          assert.ok(opaque > 100 && base/opaque > .98, `${layer.name}: no solid dark outline or shading (${base}/${opaque})`);
          if (/olkavarsi/.test(layer.name!)) {
            // Sample the overlapping shoulder surface, away from the cardigan opening/details.
            const x = layer.name!.startsWith('Oikea') ? torso.left! + 20 : torso.right! - 21;
            assert.deepEqual(pixel(torso,x,460), [...palette.shirt,255], 'torso shoulder matches sleeve base');
          }
        }
      }
    }
  });
}
