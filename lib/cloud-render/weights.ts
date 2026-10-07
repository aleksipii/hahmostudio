/** Large model weights must never live on the user's machine or be copied to storage/artifacts. */
export const WEIGHT_EXTENSIONS=['.safetensors','.ckpt','.bin','.pth','.pt','.gguf','.onnx','.sft','.pkl','.h5','.npz'] as const;
export function isModelWeightName(name:string){const n=name.toLowerCase();return WEIGHT_EXTENSIONS.some(e=>n.endsWith(e));}
