import type {Scene} from './scene-model.ts';

/** Käsikirjoitusnäkymän rakennettu jakso, jota ei ole lisätty projektiin. Vienti käyttää vain lisättyjä kohtauksia, joten tällainen luonnos puuttuisi valmiista videosta. */
export type PendingEpisodeDraft={kind:'new'|'changed';title:string};
export function pendingEpisodeDraft(scene:Scene):PendingEpisodeDraft|null{
 const draft=scene.presentationDraft;if(!draft)return null;
 const committed=scene.presentations??[],title=draft.metadata.title||draft.id,same=committed.find(p=>p.id===draft.id);
 // Sama teksti ja samat tapahtumat = ei vientiin vaikuttavaa muutosta (esim. uudelleenrakennus ilman muokkausta).
 if(same)return same.original===draft.original&&JSON.stringify(same.events)===JSON.stringify(draft.events)?null:{kind:'changed',title};
 // Uusi kohtaus aiempien rinnalla on tavallinen keskeneräinen työ; aiempien kohtausten vienti on silloin tarkoituksellinen.
 return committed.length?null:{kind:'new',title};
}
export function pendingEpisodeMessage(p:PendingEpisodeDraft){
 return p.kind==='new'
  ?`Jakso “${p.title}” on rakennettu vain esikatseluun, eikä se ole vielä videossa. Paina käsikirjoitusnäkymässä Rakenna muokattava jakso projektiin ja vie sitten.`
  :`Kohtaukseen “${p.title}” on tehty muutoksia, joita ei ole vielä päivitetty projektiin. Video tehtäisiin edellisellä versiolla. Paina käsikirjoitusnäkymässä Päivitä kohtaus ja vie sitten.`;
}
