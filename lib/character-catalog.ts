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
 {name:'Pipsa',description:'Viivaton leikkaushahmo · keltainen sadetakki, huppu ja silmälasit · 2D',alt:'Pipsa, keltainen sadetakki ja huppu, punaiset silmälasit ja lapaset',quality:{views:1,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Pipsa-3D',description:'Pipsa · neljä kuvakulmaa · 3D-paperitasot',alt:'Pipsa neljästä kuvakulmasta',quality:{views:4,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Ville',description:'Viivaton leikkaushahmo · kiharat ja pisamat · 2D',alt:'Ville, kihara kuparinen tukka, pisamat ja ruskea neule',quality:{views:1,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Ville-3D',description:'Ville · neljä kuvakulmaa · 3D-paperitasot',alt:'Ville neljästä kuvakulmasta',quality:{views:4,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Taru',description:'Viivaton leikkaushahmo · nutturat ja kuulokkeet · 2D',alt:'Taru, hiusnutturat, violetit kuulokkeet ja oranssi huppari',quality:{views:1,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Taru-3D',description:'Taru · neljä kuvakulmaa · 3D-paperitasot',alt:'Taru neljästä kuvakulmasta',quality:{views:4,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Ukko',description:'Viivaton leikkaushahmo · kalju, viikset ja villatakki · 2D',alt:'Ukko, kalju, valkoiset viikset ja vihreä villatakki',quality:{views:1,mouths:5,fullBody:true,origin:'studio'}},
 {name:'Ukko-3D',description:'Ukko · neljä kuvakulmaa · 3D-paperitasot',alt:'Ukko neljästä kuvakulmasta',quality:{views:4,mouths:5,fullBody:true,origin:'studio'}},
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
