/** True when the original script line requests an instant camera cut (not a soft pan). */
export function isHardCameraCutSource(text:string):boolean{
 return /^\s*(?:(?:Samalla|Meanwhile|Simultaneously):\s*)?(?:Leikkaus|Cut):/i.test(text.trimStart());
}
