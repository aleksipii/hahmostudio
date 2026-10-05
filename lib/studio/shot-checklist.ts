import {productionOverview} from './production-overview.ts';
import {productionIssues} from './validation-navigation.ts';
import type {Presentation} from '../presentation-model.ts';
export function shotChecklist(p:Presentation,shotId:string){
 const overview=productionOverview(p),shot=overview.episode.shots.find(s=>s.id===shotId);if(!shot)return;
 const issues=productionIssues(p).filter(i=>i.shotId===shot.id||i.scope==='project');
 const errors=issues.filter(i=>i.severity==='error').length;
 return{shot,checks:[
 {id:'duration',label:'Kuvan kesto',ok:shot.duration>0,detail:shot.duration>0?'Kesto on positiivinen.':'Korjaa kuvan ajoitus.'},
 {id:'diagnostics',label:'Esityksen virheet',ok:!errors,detail:errors?errors+' estävää ilmoitusta. Avaa Tuotannon tarkistus.':'Ei nykyisen esityksen virheilmoituksia.'},
 {id:'audio',label:'Repliikkien ääniviitteet',ok:shot.audioStatus!=='missing',detail:shot.audioStatus==='missing'?'Liitä puuttuvat repliikkiäänet.':shot.audioStatus==='silent'?'Kuvassa ei ole repliikkejä.':'Ääniviitteet on liitetty; tiedostot tarkistetaan viennissä.'},
 {id:'comments',label:'Avoin palaute',ok:!overview.byShot.get(shot.id),detail:(overview.byShot.get(shot.id)??0)+' avointa kommenttia.'},
 {id:'approval',label:'Käyttäjän hyväksyntä',ok:shot.status!=='draft',detail:shot.status==='locked'?'Hyväksytty ja lukittu.':shot.status==='approved'?'Hyväksytty.':'Luonnos; hyväksyntä on käyttäjän päätös.'}
 ]};
}
