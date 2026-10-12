/** Focusable controls inside a modal, in DOM order. Hidden ones are filtered by the caller. */
export const DIALOG_FOCUSABLE='button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex]:not([tabindex="-1"])';

/** Where Tab/Shift+Tab must move focus to stay inside a modal; null lets the browser move it normally. */
export function trappedFocusTarget<T>(items:readonly T[],active:T|null,inside:boolean,shift:boolean):T|null{
 if(!items.length)return null;
 const first=items[0],last=items[items.length-1];
 if(!inside||active===null||!items.includes(active))return shift?last:first;
 if(shift&&active===first)return last;
 if(!shift&&active===last)return first;
 return null;
}
