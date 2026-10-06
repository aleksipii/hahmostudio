import type { PresentationAssets } from './presentation-compile.ts';
import { bytesId } from './presentation-model.ts';
import { flatten } from './psd-model.ts';
import { readProject } from './project-file.ts';

export async function loadPresentationCastPack(
  assets: PresentationAssets,
  name: string,
  file?: File,
  urlSink?: string[],
): Promise<{ id: string; assets: PresentationAssets }> {
  const blob: Blob = file
    ? file
    : await fetch(`${import.meta.env.BASE_URL}library/${name}.hahmo`).then(r => {
        if (!r.ok) throw new Error('Hahmopaketti puuttuu.');
        return r.blob();
      });
  const p = await readProject(blob);
  delete p.doc.presentationAssets;
  delete p.doc.presentationAudio;
  if (!p.doc.quick) throw new Error('Valitse .hahmo, jossa on valmiit pikaanimoinnin sidokset.');
  for (const n of flatten(p.doc.layers)) {
    if (n.png) {
      const url = URL.createObjectURL(n.png);
      urlSink?.push(url);
      const image = new Image();
      image.src = url;
      await image.decode();
      n.url = url;
      n.image = image;
    }
  }
  const id = file ? `cast-${bytesId(new Uint8Array(await blob.arrayBuffer()))}` : name;
  return { id, assets: { ...assets, [id]: { doc: p.doc, animation: p.animation } } };
}
