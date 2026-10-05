import {shotChecklist} from '../lib/studio/shot-checklist';
import type {Presentation} from '../lib/presentation-model';
export default function ShotChecklist({presentation,shotId}:{presentation:Presentation;shotId:string}){
 const result=shotChecklist(presentation,shotId);if(!result)return null;
 return <details className="studio-validation"><summary>{result.shot.name} · tarkistuslista</summary><p>Tämä on kuvakohtainen tarkistus, ei renderöinnin onnistumisen todistus. Vienti-ikkunan esitarkistus tarkistaa koko tallennettavan tilannekuvan valitulla vientiprofiililla.</p>{result.checks.map(c=><article key={c.id}><strong>{c.ok?'Tarkistettu':'Tarkistettavaa'} · {c.label}</strong><span>{c.detail}</span></article>)}</details>;
}
