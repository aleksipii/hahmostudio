export function createAudioContext(options?:AudioContextOptions,scope:typeof globalThis=globalThis):AudioContext{
 const host=scope as typeof globalThis&{webkitAudioContext?:typeof AudioContext};const Context=host.AudioContext??host.webkitAudioContext;
 if(!Context)throw new Error('Selain ei tue äänen käsittelyä. Päivitä selain tai jatka ilman ääntä.');
 return new Context(options);
}
