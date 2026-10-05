import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../styles/tokens.css',import.meta.url),'utf8');
const color=(text:string,id:string)=>{const match=text.match(new RegExp(`--${id}:\\s*(#[0-9a-fA-F]{6})`));assert.ok(match,`${id} requires a hex color`);return match[1];};
const luminance=(hex:string)=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
for(const [name,scope] of [['dark',css],['light',css.match(/:root\[data-theme='light'\]\s*\{([^}]+)\}/)![1]]] as const)test(`primary button contrast meets AA in ${name} theme`,()=>{const a=luminance(color(scope,'color-accent')),b=luminance(color(scope,'color-accent-contrast'));assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5);});
