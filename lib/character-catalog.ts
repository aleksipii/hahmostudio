/**
 * Hahmokirjaston luettelo ja laatutasot.
 *
 * Studio-taso: hahmo täyttää elokuvatuotannon vähimmäisvaatimukset eli vähintään kolme piirrettyä kuvakulmaa,
 * vähintään neljä suumuotoa huulisynkkaan ja koko vartalo jalkoineen (kävely). Muut kirjaston hahmot ovat
 * Luonnoksia: ne ovat edelleen käytettävissä, mutta Roolituksessa erillisessä Luonnokset-osiossa puuttuvien
 * vaatimusten kanssa. Käyttäjän omasta aineistosta tehdyt hahmot ovat Omia ja näkyvät aina.
 *
 * `quality` on mitattu .hahmo-paketeista; `character-catalog.test.ts` lukee paketit ja varmistaa arvot.
 */
export type CharacterQuality = { views: number; mouths: number; fullBody: boolean; origin: 'studio' | 'oma' };
export type CharacterEntry = { name: string; description: string; alt: string; quality: CharacterQuality };
export type CharacterTier = 'studio' | 'oma' | 'luonnos';

export const STUDIO_MIN_VIEWS = 3;
export const STUDIO_MIN_MOUTHS = 4;

export const characters: CharacterEntry[] = [
 {name:'Kille-Oma',description:'Oma PSD · polvinivelet, housut ja kengät · etunäkymä',alt:'Kille käyttäjän PSD:stä',quality:{views:1,mouths:9,fullBody:true,origin:'oma'}},
 {name:'Handu-Oma',description:'Oma PSD · kiinnitetyt jalat ja kengät · etunäkymä',alt:'Handu käyttäjän PSD:stä',quality:{views:1,mouths:9,fullBody:true,origin:'oma'}},
 {name:'Mr.Kille',description:'Alkuperäinen kartonkihahmo · 9 suuasentoa · nivelet.',alt:'Mr.Kille, sinivihreä takki ja sininen neulepipo',quality:{views:1,mouths:9,fullBody:false,origin:'studio'}},
 {name:'Mr.Handu',description:'Alkuperäinen kartonkihahmo · 9 suuasentoa · nivelet.',alt:'Mr.Handu, kuparinvärinen takki ja ruskeat hiukset',quality:{views:1,mouths:9,fullBody:false,origin:'studio'}},
 {name:'Pipsa',description:'Leikkaushahmo · keltainen sadetakki ja silmälasit · 2D',alt:'Pipsa, keltainen sadetakki, punaiset silmälasit ja musta polkkatukka',quality:{views:1,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Pipsa-3D',description:'Pipsa · kolme kuvakulmaa · 3D-paperitasot',alt:'Pipsa kolmesta kuvakulmasta',quality:{views:3,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Ville',description:'Leikkaushahmo · kiharat ja pisamat · 2D',alt:'Ville, kihara kuparinen tukka, sinappineule ja shortsit',quality:{views:1,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Ville-3D',description:'Ville · kolme kuvakulmaa · 3D-paperitasot',alt:'Ville kolmesta kuvakulmasta',quality:{views:3,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Taru',description:'Leikkaushahmo · nutturat ja kuulokkeet · 2D',alt:'Taru, hiusnutturat, violetit kuulokkeet ja oranssi huppari',quality:{views:1,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Taru-3D',description:'Taru · kolme kuvakulmaa · 3D-paperitasot',alt:'Taru kolmesta kuvakulmasta',quality:{views:3,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Ukko',description:'Leikkaushahmo · viikset ja villatakki · 2D',alt:'Ukko, valkoiset viikset, kalju päälaki ja beige villatakki',quality:{views:1,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Ukko-3D',description:'Ukko · kolme kuvakulmaa · 3D-paperitasot',alt:'Ukko kolmesta kuvakulmasta',quality:{views:3,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Roni-Studio',description:'Yhtenäiset housut · hymy · kolme kuvakulmaa.',alt:'Roni Studio, viimeistelty sinivihreä takki',quality:{views:3,mouths:4,fullBody:true,origin:'studio'}},
 {name:'Salla-Studio',description:'Yhtenäiset housut · hymy · kolme kuvakulmaa.',alt:'Salla Studio, viimeistelty punainen takki',quality:{views:3,mouths:4,fullBody:true,origin:'studio'}},
 {name:'Roni-Monikulma',description:'Paperileikkaustyyli · kolme kuvakulmaa · kävely ja juoksu.',alt:'Roni, oma hahmo sinivihreässä takissa ja tummilla hiuksilla',quality:{views:3,mouths:3,fullBody:true,origin:'studio'}},
 {name:'Salla-Monikulma',description:'Paperileikkaustyyli · kolme kuvakulmaa · kävely ja juoksu.',alt:'Salla, oma hahmo ruosteenpunaisessa takissa ja ruskealla polkkatukalla',quality:{views:3,mouths:3,fullBody:true,origin:'studio'}},
 {name:'Aino-Monikulma',description:'Edestä ja molemmat sivuprofiilit · kävely ja juoksu',alt:'Aino kolmessa kuvakulmassa',quality:{views:3,mouths:3,fullBody:true,origin:'studio'}},
 {name:'Otto-Monikulma',description:'Robotti · edestä ja molemmat profiilit',alt:'Otto kolmessa kuvakulmassa',quality:{views:3,mouths:3,fullBody:true,origin:'studio'}},
 {name:'Otto',description:'Robotti · koko vartalo',alt:'Turkoosi robotti',quality:{views:1,mouths:3,fullBody:true,origin:'studio'}},
 {name:'Aino',description:'Ihminen · koko vartalo',alt:'Aino, violetti paita ja tummat hiukset',quality:{views:1,mouths:3,fullBody:true,origin:'studio'}},
 {name:'Leo',description:'Ihminen · puhuva muotokuva',alt:'Leo, ruskea paita ja lyhyet hiukset',quality:{views:1,mouths:3,fullBody:false,origin:'studio'}},
 {name:'Hahmopohja',description:'Muokattava PSD-pohja',alt:'Vaalea hahmopohja erillisine osineen',quality:{views:1,mouths:3,fullBody:true,origin:'studio'}}
];

export function missingStudioCriteria(q: CharacterQuality): string[] {
  const out: string[] = [];
  if (q.views < STUDIO_MIN_VIEWS) out.push('kuvakulmat');
  if (q.mouths < STUDIO_MIN_MOUTHS) out.push('suumuodot');
  if (!q.fullBody) out.push('jalat');
  return out;
}

export function characterTier(entry: CharacterEntry): CharacterTier {
  if (entry.quality.origin === 'oma') return 'oma';
  return missingStudioCriteria(entry.quality).length ? 'luonnos' : 'studio';
}

/** Kortin lyhyt laatuyhteenveto, esim. "3 kulmaa · 5 suuta · koko vartalo". */
export function qualitySummary(q: CharacterQuality): string {
  return [q.views > 1 ? `${q.views} kulmaa` : '1 kulma', `${q.mouths} suuta`, q.fullBody ? 'koko vartalo' : 'ei jalkoja'].join(' · ');
}
