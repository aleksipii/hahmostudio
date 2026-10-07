import type {FixSuggestion} from '../lib/review-suggestions';

/** Tarkistuksen korjausehdotukset: näyttää tarkan muutoksen, käyttäjä vahvistaa napilla. Mitään ei korjata itsestään. */
export default function ReviewSuggestions({suggestions,disabled,onApply,onAction}:{suggestions:FixSuggestion[];disabled:boolean;onApply:(s:FixSuggestion)=>void;onAction:(a:NonNullable<FixSuggestion['action']>)=>void}){
 if(!suggestions.length)return null;
 return <section className="review-suggestions" aria-label="Korjausehdotukset">
  <h3>Korjausehdotukset ({suggestions.length})</h3>
  <p className="panel-note">Ehdotukset eivät muuta mitään ennen kuin painat nappia. Muutos on yksi kumottava rakennus.</p>
  <ul>{suggestions.map(s=><li key={s.id}>
   <strong>{s.title}</strong>
   <span className="panel-note">{s.detail}</span>
   {s.edit&&<code className="review-suggestions__diff"><del>{s.edit.before.trim()||'(tyhjä rivi)'}</del>{' → '}<ins>{s.edit.after.trim()}</ins></code>}
   {s.edit&&<button type="button" className="secondary" disabled={disabled} onClick={()=>onApply(s)}>Käytä ehdotusta</button>}
   {s.action&&<button type="button" className="secondary" disabled={disabled} onClick={()=>onAction(s.action!)}>{s.action==='record'?'Avaa äänitys':'Luo Kokorolla'}</button>}
  </li>)}</ul>
 </section>;
}
