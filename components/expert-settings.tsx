import {useState} from 'react';
import {applyExpertMode,readExpertMode,writeExpertMode} from '../lib/expert-mode';

export default function ExpertSettings(){
 const [on,setOn]=useState(()=>readExpertMode());
 return <fieldset className="expert-settings"><legend>Asiantuntijatila</legend><label><input type="checkbox" checked={on} onChange={e=>{const next=e.target.checked;setOn(next);writeExpertMode(next);applyExpertMode(next);}}/>Näytä tekniset tiedot</label><p>Tarkistussummat, render-revisiot ja tuotantokomentojen loki. Tiedot tallentuvat projektiin joka tapauksessa; tämä valinta vain näyttää ne.</p></fieldset>;
}
