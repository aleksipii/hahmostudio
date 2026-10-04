export interface LayerNode {
 locked?: boolean; edit?: import("./layer-edit.ts").LayerEdit;
 key: string; psdId?: number; name: string; path: string; kind: 'group' | 'layer';
 left: number; top: number; width: number; height: number; opacity: number;
 visible: boolean; blendMode: string; png?: Blob; url?: string; image?: HTMLImageElement;
 children: LayerNode[]; warnings: string[];
}
export interface PsdDocument {
 presentationAssets?: import("./presentation-compile.ts").PresentationAssets; presentationAudio?: Record<string,import("./presentation-audio.ts").PresentationAudio>;
 quick?: import("./quick-animation.ts").QuickProfile; sourcePsd?: Blob;
 name: string; width: number; height: number; size: number; layers: LayerNode[];
 composite?: Blob; compositeUrl?: string; compositeImage?: HTMLImageElement; warnings: string[];
}
export const flatten = (nodes: LayerNode[]): LayerNode[] => nodes.flatMap(n => [n, ...flatten(n.children)]);
export const blendModes: Record<string, GlobalCompositeOperation> = {
 normal: 'source-over', 'pass through': 'source-over', multiply: 'multiply', screen: 'screen',
 overlay: 'overlay', darken: 'darken', lighten: 'lighten', 'color dodge': 'color-dodge',
 'color burn': 'color-burn', 'hard light': 'hard-light', 'soft light': 'soft-light',
 difference: 'difference', exclusion: 'exclusion', hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity',
};
export function releaseDocument(doc?: PsdDocument | null) {
 if (!doc) return;
 for(const asset of Object.values(doc.presentationAssets??{}))releaseDocument(asset.doc);
 for (const n of flatten(doc.layers)) if (n.url) URL.revokeObjectURL(n.url);
 if (doc.compositeUrl) URL.revokeObjectURL(doc.compositeUrl);
}
export function safeName(name: string) { return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || 'taso'; }
