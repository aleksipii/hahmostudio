import type { StudioFlowStep } from './studio-flow-scope.ts';

/**
 * Ominaisuuskartta: jokaisella käyttäjälle näkyvällä toiminnolla on yksi koti.
 *
 * - `department`: Tuotanto (viisi työvaihetta), Työpaja (hahmon rakentaminen) tai Yleinen (projekti, näkymä, ohje).
 * - `layer`: progressiivisen paljastuksen kerros.
 *   `paa` = näkyy aina kodissaan, `tarkastelija` = oikea paneeli valinnan mukaan,
 *   `valikko` = projekti-/näkymävalikko tai paneelin oma välilehti, `haku` = vain ⌘K-haussa.
 * - `palette`: ⌘K-komennon tunniste editorissa. Etuliitteellä päättyvä (`phase-`) kattaa koko ryhmän.
 *
 * Mitään ominaisuutta ei poisteta: kartta ja sen testi varmistavat, että jokainen toiminto löytyy
 * joko kodistaan tai ⌘K-haulla, ja että kunkin työvaiheen päänäkymä pysyy väljänä.
 */
export type Department = 'tuotanto' | 'tyopaja' | 'yleinen';
export type DisclosureLayer = 'paa' | 'tarkastelija' | 'valikko' | 'haku';
export type FeatureHome = {
  id: string;
  label: string;
  department: Department;
  step?: StudioFlowStep;
  layer: DisclosureLayer;
  palette?: string;
};

/** Työvaiheen päänäkymässä (yläpalkin ja näyttämön palkin alueella) saa olla enintään näin monta toimintoa. */
export const MAX_PRIMARY_ACTIONS = 7;

export const studioFeatureMap: FeatureHome[] = [
  // Yleinen: yläpalkki, projektivalikko, näkymä ja ohje
  { id: 'phases', label: 'Tuotannon työvaiheet ⌥1–⌥5', department: 'yleinen', layer: 'paa', palette: 'phase-' },
  { id: 'save', label: 'Tallenna projekti', department: 'yleinen', layer: 'paa', palette: 'save' },
  { id: 'save-as', label: 'Tallenna nimellä', department: 'yleinen', layer: 'valikko', palette: 'save-as' },
  { id: 'open', label: 'Avaa projekti', department: 'yleinen', layer: 'valikko', palette: 'open' },
  { id: 'import', label: 'Tuo kuva / PSD', department: 'yleinen', layer: 'valikko', palette: 'import' },
  { id: 'audio', label: 'Lisää ääni', department: 'yleinen', layer: 'valikko', palette: 'audio' },
  { id: 'undo', label: 'Kumoa', department: 'yleinen', layer: 'paa', palette: 'undo' },
  { id: 'redo', label: 'Tee uudelleen', department: 'yleinen', layer: 'paa', palette: 'redo' },
  { id: 'search', label: 'Hae toimintoa ⌘K', department: 'yleinen', layer: 'paa' },
  { id: 'view-timeline', label: 'Näytä/piilota aikajana', department: 'yleinen', layer: 'valikko', palette: 'timeline' },
  { id: 'view-library', label: 'Näytä/piilota vasen paneeli', department: 'yleinen', layer: 'valikko', palette: 'library' },
  { id: 'view-inspector', label: 'Näytä/piilota oikea paneeli', department: 'yleinen', layer: 'valikko', palette: 'inspector' },
  { id: 'focus-stage', label: 'Keskity näyttämöön', department: 'yleinen', layer: 'valikko', palette: 'focus-stage' },
  { id: 'reset-panels', label: 'Palauta paneelien koot', department: 'yleinen', layer: 'valikko', palette: 'reset-panels' },
  { id: 'fit', label: 'Sovita näyttämö', department: 'yleinen', layer: 'valikko', palette: 'fit' },
  { id: 'theme-system', label: 'Ulkoasu: järjestelmä', department: 'yleinen', layer: 'valikko', palette: 'theme-system' },
  { id: 'theme-dark', label: 'Ulkoasu: tumma', department: 'yleinen', layer: 'valikko', palette: 'theme-dark' },
  { id: 'theme-light', label: 'Ulkoasu: vaalea', department: 'yleinen', layer: 'valikko', palette: 'theme-light' },
  { id: 'settings', label: 'Asetukset', department: 'yleinen', layer: 'valikko', palette: 'settings' },
  { id: 'help', label: 'Käyttöohje', department: 'yleinen', layer: 'valikko', palette: 'help' },
  { id: 'tour', label: 'Tuotantokierros', department: 'yleinen', layer: 'valikko', palette: 'tour' },
  { id: 'cam-stop', label: 'Sulje kamera', department: 'yleinen', layer: 'haku', palette: 'cam-stop' },
  { id: 'mic-stop', label: 'Sulje mikrofoni', department: 'yleinen', layer: 'haku', palette: 'mic-stop' },
  { id: 'logout', label: 'Kirjaudu ulos', department: 'yleinen', layer: 'valikko', palette: 'logout' },
  { id: 'open-anim', label: 'Avaa animaatio JSON', department: 'yleinen', layer: 'valikko', palette: 'open-anim' },
  { id: 'save-anim', label: 'Tallenna animaatio JSON', department: 'yleinen', layer: 'valikko', palette: 'save-anim' },

  // 1 Tarina
  { id: 'script-editor', label: 'Käsikirjoitus ja palikkaeditori', department: 'tuotanto', step: 'script', layer: 'paa' },
  { id: 'script-focus', label: 'Keskittymistila', department: 'tuotanto', step: 'script', layer: 'paa', palette: 'script-focus' },
  { id: 'script-example', label: 'Esimerkkianimaatio', department: 'tuotanto', step: 'script', layer: 'paa', palette: 'script-example' },
  { id: 'script-motion', label: 'Yhden hahmon liikekäsikirjoitus', department: 'tuotanto', step: 'script', layer: 'paa', palette: 'script-motion' },
  { id: 'script-check', label: 'Tunnistuksen tarkistus ja korjausehdotukset', department: 'tuotanto', step: 'script', layer: 'tarkastelija' },

  // 2 Roolitus
  { id: 'cast-library', label: 'Kirjasto: hahmot, ympäristöt ja esineet', department: 'tuotanto', step: 'characters', layer: 'paa', palette: 'char-library' },
  { id: 'cast-binding', label: 'Puhujat → hahmot', department: 'tuotanto', step: 'characters', layer: 'paa' },
  { id: 'cast-angle', label: 'Hahmon kuvakulma', department: 'tuotanto', step: 'characters', layer: 'paa' },
  { id: 'cast-perform', label: 'Live-esitys: kamera, mikrofoni ja näppäimet', department: 'tuotanto', step: 'characters', layer: 'tarkastelija', palette: 'char-perform' },

  // 3 Storyboard
  { id: 'board', label: 'Kuvakortit ja järjestys', department: 'tuotanto', step: 'storyboard', layer: 'paa' },
  { id: 'board-review', label: 'Hyväksyntä, lukitus ja tarkistuskommentit', department: 'tuotanto', step: 'storyboard', layer: 'tarkastelija' },
  { id: 'board-tasks', label: 'Kuvatehtävät ja työjono', department: 'tuotanto', step: 'storyboard', layer: 'tarkastelija' },

  // 4 Kuvaus
  { id: 'shot-strip', label: 'Kuvanauha', department: 'tuotanto', step: 'shot', layer: 'paa' },
  { id: 'shot-motion', label: 'Liiketyökalut: käyrä, tilakone, kävely, IK, suu', department: 'tuotanto', step: 'shot', layer: 'tarkastelija', palette: 'shot-motion' },
  { id: 'shot-scene', label: 'Näyttämö: videon muoto, tausta ja turva-alue', department: 'tuotanto', step: 'shot', layer: 'tarkastelija', palette: 'shot-scene' },
  { id: 'center', label: 'Keskitä hahmo', department: 'tuotanto', step: 'shot', layer: 'haku', palette: 'center' },

  // 5 Leikkaus
  { id: 'timeline-panel', label: 'Aikajana', department: 'tuotanto', step: 'timeline', layer: 'paa' },
  { id: 'play', label: 'Toista / tauko', department: 'tuotanto', step: 'timeline', layer: 'paa', palette: 'play' },
  { id: 'export-phase', label: 'Vienti ja sarja', department: 'tuotanto', step: 'timeline', layer: 'paa', palette: 'export-phase' },
  { id: 'video', label: 'Vie MP4', department: 'tuotanto', step: 'timeline', layer: 'paa', palette: 'video' },
  { id: 'png', label: 'Vie PNG-kuvasarja', department: 'tuotanto', step: 'timeline', layer: 'valikko', palette: 'png' },
  { id: 'episodes', label: 'Jaksot ja sarja', department: 'tuotanto', step: 'timeline', layer: 'valikko' },

  // Työpaja: hahmon rakentaminen
  { id: 'workshop', label: 'Työpaja ⌥6', department: 'tyopaja', layer: 'paa', palette: 'char-build' },
  { id: 'layers', label: 'Tasot ja haku', department: 'tyopaja', layer: 'paa', palette: 'char-layers' },
  { id: 'rig', label: 'Nivelmääritys', department: 'tyopaja', layer: 'paa', palette: 'char-rig' },
  { id: 'draw', label: 'Piirtäminen', department: 'tyopaja', layer: 'paa', palette: 'char-draw' },
  { id: 'import-review', label: 'Tarkista tuonti', department: 'tyopaja', layer: 'paa', palette: 'char-review' },
  { id: 'preview-bg', label: 'Esikatselun tausta', department: 'tyopaja', layer: 'paa', palette: 'preview-bg-' },
  { id: 'suggest-rig', label: 'Ehdota nivelet tasojen nimistä', department: 'tyopaja', layer: 'valikko', palette: 'suggest-rig' },
  { id: 'open-rig', label: 'Avaa nivelet JSON', department: 'tyopaja', layer: 'valikko', palette: 'open-rig' },
  { id: 'save-rig', label: 'Tallenna nivelet JSON', department: 'tyopaja', layer: 'valikko', palette: 'save-rig' },
];

/** Kodin päänäkymän toiminnot: työvaihe tai Työpaja. */
export function primaryActions(home: StudioFlowStep | 'tyopaja'): FeatureHome[] {
  return studioFeatureMap.filter((f) => f.layer === 'paa' && (home === 'tyopaja' ? f.department === 'tyopaja' : f.step === home));
}
