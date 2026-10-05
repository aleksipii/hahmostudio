export type SemanticChange={path:string[];before?:unknown;after?:unknown;splice?:{index:number;remove:unknown[];insert:unknown[]}};
export type SemanticDelta={version:1;changes:SemanticChange[]};
export function equalJson(a:unknown,b:unknown):boolean;
export function semanticDelta(before:unknown,after:unknown):SemanticDelta;
export function applySemanticDelta(before:unknown,delta:SemanticDelta):unknown;
