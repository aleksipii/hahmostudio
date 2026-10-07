/**
 * Sääntöpohjainen käsikirjoitustunnistin (suomi + englanti).
 *
 * Kaksi kerrosta:
 *  1. Rivitilakone (header → body ⇄ cue → dialogue, comment-block) päättää rivin roolin
 *     käsikirjoituksen rakenteessa: kohtausotsikko, siirtymä, kuvakoko, puhuja, sulkeohje,
 *     repliikki, metatieto, kommentti tai ohjerivi.
 *  2. Ohjerivit jaetaan lauseisiin ja jokainen lause tunnistetaan suljetulla sanastolla:
 *     liike + suunta + kesto, ilme, katse, puhelin, tauko, rajoitus, ympäristö, otsikkokortti.
 *
 * Ei osamerkkijonohakua: verbit tunnistetaan kokonaisista sanoista suomen taivutusmuotoineen,
 * hahmot sijamuotoineen. Mitään ei arvata: tuntematon lause jää `unknown`-tilaan ja syy kerrotaan.
 * Tunnistin ei tuota puhetta eikä aja koodia käsikirjoituksesta.
 */

export type ScriptLanguage = 'fi' | 'en' | 'neutral';
export type RecognizerState = 'header' | 'body' | 'cue' | 'dialogue' | 'comment-block' | 'notes';
export type LineKind =
  | 'empty' | 'strict-header' | 'comment' | 'metadata' | 'scene-heading' | 'timecode' | 'transition'
  | 'shot' | 'character-decl' | 'cue' | 'parenthetical' | 'dialogue' | 'direction' | 'unknown';

export type ProductionMotion =
  | 'walk-left' | 'walk-right' | 'walk-front' | 'run-left' | 'run-right' | 'run-front'
  | 'wave' | 'point' | 'fist' | 'sit' | 'jump' | 'crouch' | 'nod' | 'react-nod' | 'react-surprise' | 'react-wave' | 'stop';
export type SupportedExpression = 'angry' | 'worried' | 'confused' | 'mildly_hurt' | 'dead_stare' | 'eyebrow_raise' | 'happy' | 'sad' | 'scared';
export type ShotSize = 'wide' | 'medium' | 'close';
export type CameraMove = 'pan' | 'tilt' | 'zoom-in' | 'zoom-out' | 'tracking' | 'dolly' | 'static';
export type Transition = 'cut' | 'fade-in' | 'fade-out' | 'dissolve' | 'smash-cut' | 'match-cut';
export type PhoneAction = 'phone_hold' | 'phone_look' | 'phone_tap' | 'show_phone' | 'phone_camera' | 'phone_ear' | 'phone_down' | 'phone_transfer';

export type Clause =
  | { type: 'motion'; actor: string; value: ProductionMotion; seconds?: number; estimated: boolean; text: string }
  | { type: 'expression'; actor: string; value: SupportedExpression; text: string }
  | { type: 'gaze'; actor: string; target: string; seconds?: number; text: string }
  | { type: 'phone'; actor: string; value: PhoneAction | 'phone-on' | 'phone-off'; text: string }
  | { type: 'hold'; actor: string; value: 'pause' | 'silence' | 'dead_stare'; seconds?: number; text: string }
  | { type: 'constraint'; actor: string; value: 'still' | 'small-gestures' | 'no-extra-props' | 'camera-still' | 'hard-cuts' | 'no-dialogue' | 'other'; text: string }
  | { type: 'environment'; value: string; text: string }
  | { type: 'title-card'; value: string; seconds?: number; text: string }
  | { type: 'note'; text: string }
  | { type: 'editing'; value: 'faster' | 'slower' | 'hard-cuts' | 'rhythm'; text: string }
  | { type: 'unsupported'; actor: string; label: string; text: string; reason: string }
  | { type: 'unknown'; text: string };

export type RecognizedLine = {
  line: number;
  raw: string;
  text: string;
  kind: LineKind;
  state: RecognizerState;
  language: ScriptLanguage;
  speaker?: string;
  dialogue?: string;
  parenthetical?: string;
  extension?: string;
  scene?: { name: string; place?: 'int' | 'ext' | 'int-ext'; time?: string; start?: number; end?: number };
  transition?: Transition;
  shot?: { size?: ShotSize; target?: string; move?: CameraMove; angle?: 'pov' | 'over-shoulder' | 'two-shot' | 'high' | 'low' | 'insert' }[];
  metadata?: { key: string; value: string };
  clauses: Clause[];
};

export type RecognizedScript = {
  language: ScriptLanguage;
  characters: string[];
  lines: RecognizedLine[];
  stats: { lines: number; content: number; recognized: number; unknown: number; percent: number };
};

/* ───────────────────────── Normalisointi ja apurit ───────────────────────── */

/** Unicode-sanaraja: JavaScriptin \\b ei tunne ä/ö/å-kirjaimia. */
const UB = String.raw`(?:(?<![\p{L}\d])(?=[\p{L}\d])|(?<=[\p{L}\d])(?![\p{L}\d]))`;
const ureCache = new Map<string, RegExp>();
const ure = (source: string, flags = '') => {
  const key = flags + '\u0000' + source;
  let re = ureCache.get(key);
  if (!re) { re = new RegExp(source.replaceAll('\\b', UB), flags.includes('u') ? flags : flags + 'u'); ureCache.set(key, re); }
  re.lastIndex = 0;
  return re;
};


const lower = (s: string) => s.toLocaleLowerCase('fi-FI');
const upper = (s: string) => s.toLocaleUpperCase('fi-FI');
const words = (s: string) => lower(s).match(/[\p{L}\d'’-]+/gu) ?? [];
export const normalizeName = (s: string) => upper(s.trim().replace(/[.:]+$/, '').replace(/\s+/g, ' '));

/** Siistii markdown-korostukset, otsikkomerkit ja rivin lopun kenoviivan. */
export function cleanLine(raw: string): string {
  return raw.trim().replace(/^#{1,6}\s*/, '').replace(/^>\s?/, '').replace(/\*\*|__/g, '').replace(/^\*(.*)\*$/, '$1').replace(/\\$/, '').trim();
}

/* ───────────────────────── Kestot ───────────────────────── */

const fiNumbers: Record<string, number> = {
  puoli: 0.5, puolen: 0.5, yksi: 1, yhden: 1, yhtä: 1, kaksi: 2, kahden: 2, kahta: 2, kolme: 3, kolmen: 3, kolmea: 3,
  neljä: 4, neljän: 4, neljää: 4, viisi: 5, viiden: 5, viittä: 5, kuusi: 6, kuuden: 6, kuutta: 6, seitsemän: 7, seitsemää: 7,
  kahdeksan: 8, kahdeksaa: 8, yhdeksän: 9, yhdeksää: 9, kymmenen: 10, kymmentä: 10,
};
const enNumbers: Record<string, number> = {
  half: 0.5, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const secondUnit = String.raw`(?:s|sek|sec|secs|sekunti|sekuntia|sekunnin|sekunnissa|sekunniksi|sekuntiin|sekunnista|second|seconds)\b(?:\s+ajan)?`;

/** Kesto sekunteina: "2 s", "0,5 sekuntia", "1–2 s" (yläraja), "puoli sekuntia", "two seconds", "half a second", "500 ms", "beat". */
export function parseDuration(text: string): { seconds: number; approximate: boolean } | undefined {
  const t = lower(text).replace(/(\d),(\d)/g, '$1.$2');
  const approximate = RX18.test(t) || /~/.test(t);
  let m = t.match(RX19);
  if (m) return { seconds: +m[1] / 1000, approximate };
  m = t.match(RX20);
  if (m) return { seconds: +m[2], approximate: true };
  m = t.match(RX21);
  if (m) return { seconds: +m[1], approximate };
  m = t.match(RX22);
  if (m) return { seconds: 0.5, approximate };
  m = t.match(RX23);
  if (m) return { seconds: 0.5, approximate };
  m = t.match(RX24);
  if (m && fiNumbers[m[1]] !== undefined) return { seconds: fiNumbers[m[1]], approximate };
  m = t.match(RX25);
  if (m && enNumbers[m[1]] !== undefined) return { seconds: enNumbers[m[1]], approximate };
  return undefined;
}

/* ───────────────────────── Kielen tunnistus ───────────────────────── */

const fiMarkers = new Set(['ja', 'on', 'ei', 'että', 'hän', 'se', 'kun', 'mutta', 'tai', 'katsoo', 'sanoo', 'kohtaus', 'tauko', 'hetken', 'vähän', 'kameraa', 'puhelinta', 'kävelee', 'myös', 'nyt', 'vain', 'takaisin', 'pieni', 'noin', 'sitten', 'samalla', 'kuva', 'leikkaus', 'tausta', 'hahmo', 'ilme']);
const enMarkers = new Set(['the', 'and', 'is', 'to', 'a', 'of', 'at', 'he', 'she', 'they', 'it', 'looks', 'says', 'scene', 'pause', 'beat', 'walks', 'with', 'his', 'her', 'their', 'then', 'back', 'into', 'camera', 'phone', 'but', 'not', 'small', 'about', 'meanwhile', 'shot', 'cut', 'background', 'character', 'expression']);
export function detectLanguage(text: string): ScriptLanguage {
  let fi = /[äöå]/i.test(text) ? 1 : 0, en = 0;
  for (const w of words(text)) { if (fiMarkers.has(w)) fi++; if (enMarkers.has(w)) en++; }
  return fi === en ? 'neutral' : fi > en ? 'fi' : 'en';
}

/* ───────────────────────── Sanasto ───────────────────────── */

type Rule<T> = { value: T; fi?: RegExp; en?: RegExp };

/** Suomen verbit kokonaisina sanoina (taivutusmuodot), englanti sanamuotoina. */
const motionRules: Rule<'walk' | 'run' | 'jump' | 'crouch' | 'sit' | 'wave' | 'nod' | 'point' | 'fist' | 'stop' | 'surprise'>[] = [
  { value: 'run', fi: /^(juoks\p{L}*|juos(?:ta|tiin|taan|ten)|ryntä\p{L}*|ryntäs\p{L}*|kirmaa\p{L}*|kirmasi\p{L}*|pinkoo|pinkoi|pinkovat)$/u, en: /^(run|runs|ran|running|sprints?|sprinted|sprinting|dash(?:es|ed|ing)?|rush(?:es|ed|ing)|jogs?|jogged|jogging)$/ },
  { value: 'walk', fi: /^(kävel\p{L}*|kävele|astel\p{L}*|kulke\p{L}*|kulki\p{L}*|kulje|kuljen|kuljet\p{L}*|harppo\p{L}*|marssi\p{L}*)$/u, en: /^(walk|walks|walked|walking|strolls?|strolled|strolling|steps?|stepped|stepping|paces?|paced|pacing|wanders?|wandered|wandering|marche[sd]|marching)$/ },
  { value: 'jump', fi: /^(hyppä\p{L}*|hyppää|hyppäsi|hypätä|hypähtä\p{L}*|hypähti|loikka\p{L}*|loikkasi)$/u, en: /^(jump|jumps|jumped|jumping|hops?|hopped|hopping|leaps?|leapt|leaped|leaping)$/ },
  { value: 'crouch', fi: /^(kyykist\p{L}*|kyykky\p{L}*|kyykkää|kyykkäsi|kyyristy\p{L}*|kyyristyi)$/u, en: /^(crouch|crouches|crouched|crouching|squats?|squatted|squatting|ducks|ducked|ducking)$/ },
  { value: 'sit', fi: /^(istuu|istui|istuvat|istuivat|istu|istuutuu|istuutui|istuutuvat|istahtaa|istahti|istahtavat|istuutua|istumaan)$/u, en: /^(sit|sits|sat|sitting)$/ },
  { value: 'wave', fi: /^(vilkutt\p{L}*|vilkuta|vilkutti|vilkuttaa|vilkuttavat|vilkutus)$/u, en: /^(wave|waves|waved|waving)$/ },
  { value: 'nod', fi: /^(nyökkä\p{L}*|nyökkää|nyökkäsi|nyökyttel\p{L}*|nyökäyttä\p{L}*|nyökäytti|nyökkäys)$/u, en: /^(nod|nods|nodded|nodding)$/ },
  { value: 'point', fi: /^(osoittaa|osoitti|osoittavat|osoittivat|osoittamaan|osoittaen|näyttää\s+sormella)$/u, en: /^(point|points|pointed|pointing)$/ },
  { value: 'fist', fi: /^(nyrkki\p{L}*|nyrkin|nyrkkinsä|nyrkkiin)$/u, en: /^(fist|fists|clench(?:es|ed|ing)?)$/ },
  { value: 'stop', fi: /^(pysähty\p{L}*|pysähtyy|pysähtyi|pysähtyvät|pysähdy|seisahtu\p{L}*)$/u, en: /^(stop|stops|stopped|stopping|halts?|halted|halting)$/ },
  { value: 'surprise', fi: /^(hämmästy\p{L}*|hämmästys|yllätty\p{L}*|säikähtä\p{L}*|säikähti|hätkähtä\p{L}*|hätkähti)$/u, en: /^(startled|surprised|gasps?|gasped|flinch(?:es|ed)?)$/ },
];

const expressionRules: Rule<SupportedExpression>[] = [
  { value: 'angry', fi: /^(vihai\p{L}*|suuttu\p{L}*|suuttuu|suuttui|raivo\p{L}*|ärtyny\p{L}*|ärsyyntyy|ärsyyntyi|kiukkui\p{L}*)$/u, en: /^(angry|angrily|furious|mad|annoyed|irritated|frowns?|frowned|scowls?|scowled)$/ },
  { value: 'worried', fi: /^(huolestu\p{L}*|huolissaan|hermostu\p{L}*|levottom\p{L}*|huolestuneena)$/u, en: /^(worried|worries|anxious|anxiously|nervous|nervously|concerned)$/ },
  { value: 'confused', fi: /^(hämmenty\p{L}*|ymmällään|ymmällä|miettii|mietti|pohtii|pohti|epävarm\p{L}*)$/u, en: /^(confused|puzzled|baffled|perplexed|unsure|ponders?|pondered)$/ },
  { value: 'mildly_hurt', fi: /^(loukkaantu\p{L}*|loukkaantuneelta|pahoittaa|pahoitti|nolostu\p{L}*|murjottaa|murjotti)$/u, en: /^(hurt|offended|sulks?|sulked|pouts?|pouted|embarrassed)$/ },
  { value: 'dead_stare', fi: /^(pokerinaama\p{L}*|ilmeettöm\p{L}*|ilmeetön|tuijottaa|tuijotti|tuijottavat)$/u, en: /^(deadpan|expressionless|stares?|stared|staring|blankly)$/ },
  { value: 'eyebrow_raise', fi: /^(kulmakarv\p{L}*|kulmiaan|kulmia)$/u, en: /^(eyebrows?|brows?)$/ },
  { value: 'happy', fi: /^(iloinen|iloisena|hymy|hymyil\p{L}*|hymyilee|hymyili|ilahtu\p{L}*|iloi\p{L}*|nauraa|nauroi|naurahtaa|naurahti|virnist\p{L}*)$/u, en: /^(cheerful|cheerfully|smiles?|smiled|smiling|grins?|grinned|grinning|laughs?|laughed|laughing|happy|happily|chuckles?|chuckled)$/ },
  { value: 'scared', fi: /^(pelästy\p{L}*|pelkää|pelkäsi|pelkäävät|peloissaan|pelokka\p{L}*|pelokas|kauhistu\p{L}*|kauhuissaan|hätäänty\p{L}*)$/u, en: /^(scared|afraid|frightened|terrified|fearful|fearfully|panics?|panicked)$/ },
  { value: 'sad', fi: /^(itkee|murheelli\p{L}*|alakulo\p{L}*|suree|suri|itki|surulli\p{L}*|nyyhkyttää|nyyhkytti)$/u, en: /^(cries|unhappy|gloomy|upset|tearful|cried|crying|sad|sadly|sobs?|sobbed)$/ },
];
/** Tunnistetut mutta renderöinnissä puuttuvat ilmeet: näytetään syy, ei arvata korvaavaa. */
const unsupportedExpressionRules: { label: string; fi: RegExp; en: RegExp }[] = [
];

const gazeVerb = { fi: /^(katse|katseen|katseella|tuijottaa|tuijotti|tuijottavat|katsoo|katsoi|katsovat|katsoivat|katso|katsoen|vilkaisee|vilkaisi|vilkaisevat|vilkuilee|vilkuili|silmäilee|silmäili|tähyilee|kääntää\s+katseensa)$/u, en: /^(stares?|stared|staring|looks?|looked|looking|glances?|glanced|glancing|eyes|eyed|peeks?|peeked|peers?|peered)$/ };
const phoneNoun = { fi: /^(puhelin|puhelinta|puhelimen|puhelimeen|puhelimesta|puhelimessa|puhelimella|puhelimelle|puhelintaan|puhelimeensa|puhelimeensä|puhelimestaan|kännykkä\p{L}*|kännykän|kännyä)$/u, en: /^(phone|phones|cellphone|smartphone|mobile)$/ };
const cameraNoun = { fi: /^(kameraan|kameraa|kameralle|katsojaan|katsojaa|katsojia|yleisöön)$/u, en: /^(camera|audience|viewer|viewers|lens)$/ };

const directionRules: { value: 'left' | 'right' | 'front'; fi: RegExp; en: RegExp }[] = [
  { value: 'left', fi: ure(String.raw`\b(vasemmalle|vasempaan|kohti\s+vasenta|vasemmalle\s+päin)\b`, 'u'), en: ure(String.raw`\b(left|leftward|leftwards)\b`, '') },
  { value: 'right', fi: ure(String.raw`\b(oikealle|oikeaan|kohti\s+oikeaa|oikealle\s+päin)\b`, 'u'), en: ure(String.raw`\b(right|rightward|rightwards)\b`, '') },
  { value: 'front', fi: ure(String.raw`\b(suoraan|eteenpäin|kohti\s+(?:katsojaa|kameraa)|(?:katsojaa|kameraa)\s+kohti|eteen)\b`, 'u'), en: ure(String.raw`\b(forward|forwards|ahead|toward(?:s)?\s+(?:the\s+)?(?:camera|viewer|audience)|straight\s+ahead)\b`, '') },
];

const pronouns = { fi: new Set(['hän', 'häntä', 'hänen']), en: new Set(['he', 'she', 'him', 'her']) };
const plural = { fi: new Set(['he', 'molemmat', 'kaikki', 'kumpikin']), en: new Set(['they', 'both', 'everyone', 'them']) };
/** Kaikki hahmot ("molemmat hyppäävät", "they both jump"). */
export const ALL_ACTORS = '*';
const fiCaseSuffix = /^(n|a|ä|ta|tä|lle|lta|ltä|lla|llä|ssa|ssä|sta|stä|ksi|na|nä|han|hen|hin|hon|hun|hyn|seen|en|in|un|yn|an|än|kin|nkin|lla|kaan|kään|lle?en|ä?n|kaan)$/u;

/* ───────────────────────── Rakennerivit ───────────────────────── */

const metaKeys: [RegExp, string][] = [
  [/^(jakson nimi|nimi|title|episode title)$/i, 'title'], [/^(pituus|kesto|tavoitepituus|duration|length|runtime)$/i, 'duration'],
  [/^(tarkoitus|purpose|tavoite|goal)$/i, 'purpose'], [/^(miljöö|environment|setting|location|paikka)$/i, 'environment'],
  [/^(tekijä|kirjoittaja|käsikirjoittaja|author|writer|written by)$/i, 'author'], [/^(logline|tiivistelmä|synopsis)$/i, 'synopsis'],
  [/^(genre|lajityyppi)$/i, 'genre'], [/^(versio|draft|version|luonnos)$/i, 'version'], [/^(sarja|series|show)$/i, 'series'],
  [/^(jakso|episode)$/i, 'episode'], [/^(kieli|language)$/i, 'language'],
  [/^(käyttö|usage|katso|see|lähde|source|ohje|instructions)$/i, 'info'],
];
const transitionRe = /^(?:(CUT TO|LEIKKAUS|SMASH CUT(?: TO)?|MATCH CUT(?: TO)?|DISSOLVE(?: TO)?|RISTIKUVA|HÄIVYTYS(?: MUSTAAN)?|FADE (?:IN|OUT|TO BLACK|TO WHITE)|HÄIVYTYS SISÄÄN|HÄIVYTYS ULOS|LOPPU|THE END)\s*[:.]?\s*)$/i;
const sceneHeadingRe = /^(?:\d+[.)]?\s+)?(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.|EXT\.|INT |EXT |SISÄ\.?\/ULKO\.?|SISÄ\.|ULKO\.|SISÄLLÄ\.?|ULKONA\.?)\s*(.+)$/i;
const sceneLabelRe = /^(?:Kohtaus|Scene|KOHTAUS|SCENE)(?:\s+(\d+))?\s*[:.–—-]\s*(.*)$/;
const timecodeRe = /^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[-–—:]\s*)?(.*)$/;
const cueExtensionRe = /\s*\((V\.?O\.?|O\.?S\.?|O\.?C\.?|CONT'?D|CONT\.|jatkuu|jatk\.|kertoja|ruudun ulkopuolelta|puhelimessa|ON PHONE|SUBTITLE|tekstitys)\)\s*$/i;
/* Kuvatermit: lyhenteet ja englannin arkisanat (WIDE, MEDIUM, CU, PAN…) vain ISOILLA kirjaimilla,
   jotta repliikki "a very wide sidewalk" ei ole kuvakoko. Yksiselitteiset termit kirjainkoosta riippumatta. */
const shotWords: [RegExp, ShotSize][] = [
  [ure(String.raw`\b(EXTREME CLOSE[- ]?UP|ECU|XCU|CLOSE[- ]?UP|CU|INSERT)\b`), 'close'],
  [ure(String.raw`\b(extreme close[- ]up|close-up|close up shot|erikoislähikuva\p{L}*|lähikuva\p{L}*|yksityiskohtakuva\p{L}*)\b`, 'i'), 'close'],
  [ure(String.raw`\b(MEDIUM(?: SHOT| CLOSE[- ]?UP)?|MS|MCU|MID[- ]SHOT)\b`), 'medium'],
  [ure(String.raw`\b(medium shot|medium close[- ]up|mid[- ]shot|puolilähikuva\p{L}*|puolikuva\p{L}*|keskikuva\p{L}*)\b`, 'i'), 'medium'],
  [ure(String.raw`\b(WIDE(?: SHOT)?|WS|LONG SHOT|LS|FULL SHOT|ESTABLISHING(?: SHOT)?|TWO[- ]SHOT)\b`), 'wide'],
  [ure(String.raw`\b(wide shot|long shot|full shot|establishing shot|two[- ]shot|laaja kuva|laajakuva\p{L}*|laaja|laajaan|yleiskuva\p{L}*|kokokuva\p{L}*|kaukokuva\p{L}*|kaksoiskuva\p{L}*)\b`, 'i'), 'wide'],
];
const moveWords: [RegExp, CameraMove][] = [
  [ure(String.raw`\b(ZOOMS? IN|zooms? in|zoom-in|zoomaa sisään|zoomaus sisään|zoomaa lähemmäs|zoomaa lähelle)\b`, 'i'), 'zoom-in'],
  [ure(String.raw`\b(ZOOMS? OUT|zooms? out|zoom-out|zoomaa ulos|zoomaus ulos|zoomaa kauemmas)\b`, 'i'), 'zoom-out'],
  [ure(String.raw`\b(PAN|PANS|PANNING|PAN (?:LEFT|RIGHT))\b`), 'pan'], [ure(String.raw`\b(camera pans|pans (?:left|right|across)|panoroi\p{L}*|panorointi\p{L}*)\b`, 'i'), 'pan'],
  [ure(String.raw`\b(TILT|TILTS|TILT (?:UP|DOWN))\b`), 'tilt'], [ure(String.raw`\b(camera tilts|kamera kallistuu|kallistus)\b`, 'i'), 'tilt'],
  [ure(String.raw`\b(TRACKING(?: SHOT)?|tracking shot|camera follows|kamera seuraa|seuraava kamera|seurantakuva\p{L}*)\b`, 'i'), 'tracking'],
  [ure(String.raw`\b(DOLLY(?: IN| OUT)?|dolly (?:in|out)|kamera-ajo\p{L}*)\b`, 'i'), 'dolly'],
  [ure(String.raw`\b(STATIC(?: SHOT)?|static shot|locked[- ]off|lukittu kamera|kamera paikallaan)\b`, 'i'), 'static'],
];
const angleWords: [RegExp, 'pov' | 'over-shoulder' | 'two-shot' | 'high' | 'low' | 'insert'][] = [
  [ure(String.raw`\b(POV)\b`), 'pov'], [ure(String.raw`\b(subjektiivinen kuva|point of view)\b`, 'i'), 'pov'],
  [ure(String.raw`\b(OTS|OVER(?: THE)? SHOULDER)\b`), 'over-shoulder'], [ure(String.raw`\b(over(?: the)? shoulder|olan yli|olkapään yli)\b`, 'i'), 'over-shoulder'],
  [ure(String.raw`\b(TWO[- ]SHOT|two[- ]shot|kaksoiskuva\p{L}*)\b`, 'i'), 'two-shot'],
  [ure(String.raw`\b(HIGH ANGLE|high angle|yläkuva\p{L}*|yläviistosta)\b`, 'i'), 'high'], [ure(String.raw`\b(LOW ANGLE|low angle|alakuva\p{L}*|alaviistosta)\b`, 'i'), 'low'],
  [ure(String.raw`\b(INSERT)\b`), 'insert'],
];
const nonCueWords = new Set(['CUT', 'CUT TO', 'WIDE', 'MEDIUM', 'CLOSE', 'CLOSE-UP', 'INT', 'EXT', 'FADE IN', 'FADE OUT', 'THE END', 'LOPPU', 'LEIKKAUS', 'LAAJA', 'LÄHIKUVA', 'PUOLIKUVA', 'POV', 'INSERT', 'BEAT', 'TAUKO', 'HOOK', 'SUPER', 'TITLE', 'KOHTAUS', 'SCENE', 'MONTAGE', 'MONTAASI', 'CONTINUOUS', 'JATKUU', 'HUOM', 'NOTE', 'ANIMAATIO']);

/** Seuraava ei-tyhjä rivi jokaiselle riville yhdellä läpikäynnillä (O(n)). */
function nextNonEmpty(lines: string[]): string[] {
  const out = new Array<string>(lines.length);
  let next = '';
  for (let i = lines.length - 1; i >= 0; i--) { out[i] = next; if (lines[i].trim()) next = lines[i]; }
  return out;
}

/* ───────────────────────── Tilakone ───────────────────────── */

const RX0 = ure(String.raw`^([\p{Lu}][\p{L}.'-]{1,35})\s+(?:sanoo|vastaa|kysyy|huutaa|kuiskaa|says|replies|asks|shouts|whispers)\b`, 'u');
const RX1 = ure(String.raw`^(pieni tauko|pitkä tauko|lyhyt tauko|tauko|hiljaisuus|beat|pause|silence|pidä|odota|wait|hold|tähän|animaatio|huom|note|ei|älä|no|do not|don't|samalla|meanwhile|täysin|noin)\b`, 'i');
const RX2 = ure(String.raw`\s*(?:→|->|>|,\s*sitten|,\s*then|\bthen\b|\bsitten\b)\s*`, 'i');
const RX3 = ure(String.raw`^(?:samalla|meanwhile|simultaneously|at the same time)\b[:,]?\s*`, 'i');
const RX4 = ure(String.raw`^(ei|älä|älkää|no|do not|don't|never)\b`, 'i');
const RX5 = ure(String.raw`liikuta|liiku\b|(?:do not|don't) move|no movement`, 'i');
const RX6 = ure(String.raw`\b(leikkausrytmi\p{L}*|leikkaus\p{L}*|rytmi\p{L}*|tempo\p{L}*|hard cut\p{L}*|hard cuts|pacing|cuts? faster|editing)\b`, 'i');
const RX7 = ure(String.raw`\b(nopeutu\p{L}*|hidast\p{L}*|speeds? up|slows? down)\b`, 'i');
const RX8 = ure(String.raw`^(beat|a beat|pause|a long pause|long pause|silence|tauko|pieni tauko|pitkä tauko|lyhyt tauko|hiljaisuus|hetken hiljaisuus|odota|wait|hold)\b`, 'i');
const RX9 = ure(String.raw`\b(tauko|tauon|hiljai\p{L}*|pidä|pitää|odota|odottaa|odotti|odottavat|odottelee|seisoo hetken|ei dialogia|hold|pause|silence|wait|waits|waited|waiting)\b`, 'iu');
const RX10 = ure(String.raw`\b(beat|pieni tauko|lyhyt tauko)\b`, 'i');
const RX11 = ure(String.raw`\b(pitkä tauko|long pause)\b`, 'i');
const RX12 = ure(String.raw`korva|to (?:his|her|their) ear|\bear\b`, 'i');
const RX13 = ure(String.raw`napaut|näpyttel|tap(?:s|ped)?\b|types? on`, 'i');
const RX14 = ure(String.raw`(?:llä|lla|lle) puhelin\b`, 'u');
const RX15 = ure(String.raw`\b(takaisin|back)\b`, 'i');
const RX16 = ure(String.raw`\bheilutt\p{L}*\s+kättä|\bheilauttaa\s+kättä`, 'iu');
const RX17 = ure(String.raw`\b(nostaa|kohottaa)\s+kulmiaan|raises? (?:an |his |her |their )?eyebrows?`, 'i');
const RX18 = ure(String.raw`\b(noin|about|around|approximately|n\.)\s`, '');
const RX19 = ure(String.raw`(\d+(?:\.\d+)?)\s*ms\b`, '');
const RX20 = ure(String.raw`(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*` + secondUnit);
const RX21 = ure(String.raw`(\d+(?:\.\d+)?)\s*` + secondUnit);
const RX22 = ure(String.raw`\b(half a|a half)\s+second\b`, '');
const RX23 = ure(String.raw`\b(puoli|puolen)\s+sekun\p{L}*`, 'u');
const RX24 = ure(String.raw`\b([\p{L}]+)\s+(?:sekunti|sekuntia|sekunnin|sekunniksi|sekuntiin|sekunnissa)\b`, 'u');
const RX25 = ure(String.raw`\b([a-z]+)\s+seconds?\b`, '');
/** Kaikki toiminta- ja ilmeverbit yhtenä lausekkeena (subjektin ja verbin paikka lauseessa). */
const anyVerbFi = new RegExp([...motionRules.map(r => r.fi!.source), ...expressionRules.map(r => r.fi!.source), gazeVerb.fi.source, String.raw`^(näyttää|näyttävät|ottaa|laittaa|pitää|pitelee|sanoo)$`].join('|'), 'u');
const anyVerbEn = new RegExp([...motionRules.map(r => r.en!.source), ...expressionRules.map(r => r.en!.source), gazeVerb.en.source, String.raw`^(shows?|takes|puts|holds?|says)$`].join('|'));

export class ScriptRecognizer {
  state: RecognizerState = 'header';
  private characters = new Map<string, string>();
  private stems: { stem: string; name: string }[] = [];
  private lastActor = '';
  private lastSpeaker = '';
  private sawContent = false;
  private lastGaze: string | undefined;

  constructor(characters: string[] = []) { for (const c of characters) this.addCharacter(c); }

  get knownCharacters(): string[] { return [...new Set(this.characters.values())]; }

  addCharacter(name: string): string {
    const n = normalizeName(name);
    if (!n || n.length > 36) return n;
    if (!this.characters.has(n)) { this.characters.set(n, n); this.stems.push({ stem: lower(n), name: n }); this.stems.sort((a, b) => b.stem.length - a.stem.length); }
    return n;
  }

  /** Hahmo tekstistä: täsmänimi, sijamuoto (Killelle, Handua, Miran) tai pronomini edelliseen hahmoon. */
  resolveActor(token: string, language: ScriptLanguage = 'neutral'): string | undefined {
    const t = lower(token.replace(/[’']s$/, ''));
    if ((language !== 'en' && pronouns.fi.has(t)) || (language !== 'fi' && pronouns.en.has(t))) return this.lastActor || undefined;
    if (((language !== 'en' && plural.fi.has(t)) || (language !== 'fi' && plural.en.has(t))) && this.characters.size > 1) return ALL_ACTORS;
    for (const { stem, name } of this.stems) {
      if (t === stem) return name;
      if (t.startsWith(stem) && fiCaseSuffix.test(t.slice(stem.length))) return name;
      // Illatiivi vokaalinpidennyksellä: Niko → Nikoon, Mira → Miraan, Kille → Killeen.
      const last = stem.at(-1) ?? '';
      if (/[aeiouyäö]/.test(last) && (t === stem + last + 'n' || t === stem + last + 'nkin')) return name;
      // Astevaihtelu / vokaalivartalo: "Kille" → "Killeä", "Mira" → "Miraa", "Niko" → "Nikolle".
      const vowelStem = stem.replace(/[aeiouyäö]$/, '');
      if (vowelStem.length >= 3 && vowelStem !== stem && t.startsWith(vowelStem) && fiCaseSuffix.test(t.slice(stem.length - 1).replace(/^[aeiouyäö]/, ''))) return name;
    }
    return undefined;
  }

  private actorIn(tokens: string[], language: ScriptLanguage): { actor?: string; index: number } {
    for (let i = 0; i < tokens.length; i++) { const a = this.resolveActor(tokens[i], language); if (a) return { actor: a, index: i }; }
    return { index: -1 };
  }

  /** Esikatselu: kerää puhujat ja hahmomääritykset ennen varsinaista ajoa, jotta sijamuodot ratkeavat. */
  prescan(lines: string[], following = nextNonEmpty(lines)): void {
    for (let i = 0; i < lines.length; i++) {
      const t = cleanLine(lines[i]);
      const decl = t.match(/^(?:Hahmo|Character)\s*:\s*([\p{L}][\p{L}\d .'-]{0,35})$/u) ?? t.match(/^(?:Hahmo|Character)\s+([\p{L}][\p{L} .]{0,35}):/u);
      if (decl) { this.addCharacter(decl[1]); continue; }
      const handle = t.match(/^(?:Tunnus\s+)?@[a-zA-Z0-9_.-]{1,32}\s*(?:→|->|:)\s*([\p{L}][\p{L}\s.]{0,35})$/u);
      if (handle) { this.addCharacter(handle[1]); continue; }
      const cue = this.cueName(t, following[i]);
      if (cue) this.addCharacter(cue.name);
      const says = t.match(RX0);
      if (says && !nonCueWords.has(upper(says[1]))) this.addCharacter(says[1]);
    }
  }

  /** Puhujarivi: "KILLE", "KILLE (V.O.)", "Kille:", "MIRA:" ennen repliikkiä. */
  private cueName(t: string, next: string): { name: string; extension?: string; inline?: string } | undefined {
    const t0 = /\)\s*:$/.test(t) ? t.replace(/:\s*$/, '') : t;
    const ext = t0.match(cueExtensionRe)?.[1];
    const base = (ext ? t0.replace(cueExtensionRe, '') + (t0 !== t ? ':' : '') : t).trim().replace(/^([^:]+):$/, '$1:');
    const colon = base.match(/^([\p{L}][\p{L} .'-]{0,35}?):\s*(.*)$/u);
    if (colon) {
      const name = colon[1].trim(), rest = colon[2].trim(), key = upper(name);
      if (nonCueWords.has(key) || metaKeys.some(([re]) => re.test(name)) || /^(Hahmo|Character|Tausta|Background|Kamera|Camera|Leikkaus|Cut|Samalla|Meanwhile|Kohtaus|Scene|Resurssi|Resource|Otsikkokortti|Title card|Lopetus|Ending|Sijainti|Position|Rekvisiitta|Prop|Puhelin|Phone|Huom|Note|Animaatio|Animation|Ääni|Voice|Luonne|Personality|Suhde|Relationship|Tunnus)$/i.test(name)) return undefined;
      if (name.split(/\s+/).length > 3) return undefined;
      if (/\s(sanoo|vastaa|kysyy|huutaa|kuiskaa|toteaa|says|replies|asks|shouts|whispers|adds)$/i.test(name) || nonCueWords.has(upper(name.split(/\s+/)[0]))) return undefined;
      if (!rest && /^[“"„(]/.test(next.trim())) return { name, extension: ext };
      if (/^[“"„]/.test(rest)) return { name, extension: ext, inline: rest };
      if (rest && (this.characters.has(key) || /^[\p{Lu}][\p{Lu} .'-]+$/u.test(name))) return { name, extension: ext, inline: rest };
      return undefined;
    }
    if (/^[\p{Lu}][\p{Lu}\d .'-]{0,35}$/u.test(base) && /\p{Lu}/u.test(base) && base.split(/\s+/).length <= 3) {
      const key = upper(base);
      if (nonCueWords.has(upper(base.split(/\s+/)[0])) || /^(CUT|LEIKKAUS|FADE|HÄIVYTYS|INT|EXT|SISÄ|ULKO)\b/.test(base)) return undefined;
      if (nonCueWords.has(key) || shotWords.some(([re]) => re.test(base)) || transitionRe.test(base) || sceneHeadingRe.test(base)) return undefined;
      const n = next.trim();
      const nextIsSpeech = /^[“"„«(]/.test(n) || (!!n && !/^[\p{Lu}\d\s.'’:()\/-]+$/u.test(n) && !sceneHeadingRe.test(n) && !timecodeRe.test(n) && !transitionRe.test(n));
      if (this.characters.has(key) || ext || (/^[“"„«(]/.test(n)) || (nextIsSpeech && base.length >= 2 && this.state !== 'header' && !/[.!?]$/.test(base))) return { name: base, extension: ext };
    }
    return undefined;
  }

  /** Tunnistaa yhden rivin ja päivittää tilan. */
  recognize(raw: string, lineNumber: number, next = ''): RecognizedLine {
    const text = raw.trim() === '#!kilsat' ? '#!kilsat' : cleanLine(raw);
    const language = text ? detectLanguage(text) : 'neutral';
    const out: RecognizedLine = { line: lineNumber, raw, text, kind: 'unknown', state: this.state, language, clauses: [] };
    const finish = (kind: LineKind, state: RecognizerState) => { out.kind = kind; this.state = state; out.state = state; return out; };

    if (!text) return finish('empty', this.state === 'dialogue' || this.state === 'cue' ? 'body' : this.state);

    // Kommenttilohkot: /* … */, [[ … ]], Character Animator -ohjausosiot.
    if (this.state === 'comment-block') return finish('comment', /\*\/\s*$|\]\]\s*$/.test(text) ? (this.sawContent ? 'body' : 'header') : 'comment-block');
    if (/^\/\*/.test(text) && !/\*\/\s*$/.test(text)) return finish('comment', 'comment-block');
    if (/^\[\[/.test(text) && !/\]\]\s*$/.test(text)) return finish('comment', 'comment-block');
    if (/^(\/\/|\/\*.*\*\/$|\[\[.*\]\]$|<!--)/.test(text)) return finish('comment', this.state);
    if (raw.trim() === '#!kilsat' || text === '!kilsat') return finish('strict-header', this.state);
    // Tuotanto-ohjeosio ("Character Animator -ohjaus", "Leikkauskieli", "Production notes") kestää seuraavaan kohtaukseen.
    if (/^(Character Animator.*ohjaus|Leikkauskieli|Animaatio-ohjeet|Ohjaajan huomiot|Tuotanto-ohjeet|Production notes|Director'?s notes|Animation notes|Editing notes)\s*:?$/i.test(text)) { out.clauses = [{ type: 'note', text }]; return finish('comment', 'notes'); }
    if (this.state === 'notes' && !timecodeRe.test(text) && !sceneHeadingRe.test(text) && !sceneLabelRe.test(text)) {
      const shots = this.shots(text, language);
      if (shots) out.shot = shots; else out.clauses = this.clauses(text, language);
      return finish('comment', 'notes');
    }
    if (/^(?:Resurssi|Resource)\s/i.test(text) || /^(?:Tunnus\s+)?@[a-zA-Z0-9_.-]{1,32}\s*(?:→|->|:)/.test(text)) return finish('metadata', this.state);

    // Metatiedot: "Pituus: 30 s", "Title: …", "KILSAT — S01E01: …".
    const episode = text.match(/^(.*?)\s*[—–-]\s*S(\d+)E(\d+)\s*:\s*[“"']?(.*?)[”"']?$/i);
    if (episode) { out.metadata = { key: 'episode', value: text }; return finish('metadata', 'header'); }
    if (/^#\s/.test(raw.trim()) && !this.sawContent && !sceneLabelRe.test(text) && !timecodeRe.test(text)) { out.metadata = { key: 'title', value: text }; return finish('metadata', 'header'); }
    const meta = text.match(/^([\p{L} ]{2,24}?)(?:\s+\d+)?:\s*(.+)$/u);
    if (meta) {
      const key = metaKeys.find(([re]) => re.test(meta[1].trim()))?.[1];
      if (key) { out.metadata = { key, value: meta[2].trim() }; if (key === 'environment') out.clauses.push({ type: 'environment', value: meta[2].trim(), text }); return finish('metadata', this.sawContent ? 'body' : 'header'); }
    }

    // Kohtausrajat.
    const tc = text.match(timecodeRe);
    if (tc) {
      const sec = (s: string) => s.split(':').map(Number).reduce((a, b) => a * 60 + b, 0);
      out.scene = { name: tc[3].trim(), start: sec(tc[1]), end: sec(tc[2]) };
      this.sawContent = true; return finish('timecode', 'body');
    }
    const heading = text.match(sceneHeadingRe);
    if (heading && /^[\p{Lu}\d\s.\/-]/u.test(text)) {
      const p = upper(heading[1]).replace(/\s/g, '');
      const [name, time] = heading[2].split(/\s+[-–—]\s+/);
      out.scene = { name: name.trim(), place: /\//.test(p) ? 'int-ext' : /^(INT|SISÄ)/.test(p) ? 'int' : 'ext', time: time?.trim() };
      this.sawContent = true; return finish('scene-heading', 'body');
    }
    const label = text.match(sceneLabelRe);
    if (label) { out.scene = { name: (label[2] || `Kohtaus ${label[1] ?? ''}`).trim() }; this.sawContent = true; return finish('scene-heading', 'body'); }

    if (transitionRe.test(text)) {
      const t = upper(text);
      out.transition = /FADE IN|SISÄÄN/.test(t) ? 'fade-in' : /FADE|HÄIVYTYS|LOPPU|THE END/.test(t) ? 'fade-out' : /DISSOLVE|RISTIKUVA/.test(t) ? 'dissolve' : /SMASH/.test(t) ? 'smash-cut' : /MATCH/.test(t) ? 'match-cut' : 'cut';
      this.sawContent = true; return finish('transition', 'body');
    }

    // Hahmomääritys.
    const decl = text.match(/^(?:Hahmo|Character)\s*:\s*([\p{L}][\p{L}\d .'-]{0,35})$/u);
    if (decl) { out.speaker = this.addCharacter(decl[1]); return finish('character-decl', this.sawContent ? 'body' : 'header'); }
    const profile = text.match(/^(?:Hahmo|Character|Luonne|Personality|Suhde|Relationship|Ääni|Voice)\s+([\p{L}][\p{L} .]{0,35}):\s*(.*)$/u);
    if (profile) { out.speaker = this.addCharacter(profile[1]); out.clauses.push({ type: 'note', text: profile[2] }); return finish('character-decl', this.sawContent ? 'body' : 'header'); }

    // Sulkeohje repliikin yhteydessä.
    const paren = text.match(/^\((.+)\)$/);
    if (paren) {
      out.parenthetical = paren[1].trim();
      out.speaker = this.lastSpeaker || undefined;
      out.clauses = this.clauses(paren[1], detectLanguage(paren[1]), this.lastSpeaker);
      if (!out.clauses.length || out.clauses.every(c => c.type === 'unknown')) out.clauses = [{ type: 'note', text: paren[1] }];
      return finish('parenthetical', this.state === 'cue' || this.state === 'dialogue' ? 'cue' : 'body');
    }

    // Repliikki puhujan jälkeen (lainausmerkeillä tai ilman).
    const quoted = text.match(/^[“"„«](.*?)[”"»]?\.?$/);
    const closed = /^[“"„«].*[”"»][.!?]?$/.test(text);
    if (this.state === 'cue' || this.state === 'dialogue') {
      if (quoted) { out.speaker = this.lastSpeaker; out.dialogue = quoted[1]; this.lastActor = this.lastSpeaker; return finish('dialogue', closed ? 'body' : 'dialogue'); }
      if (!this.looksLikeDirection(text) && !this.isExplicitDirection(text, language)) { out.speaker = this.lastSpeaker; out.dialogue = text; this.lastActor = this.lastSpeaker; return finish('dialogue', 'dialogue'); }
      this.state = 'body';
    }

    // Puhuja (oma rivi tai inline "MIRA: …").
    const cue = this.cueName(text, next);
    if (cue) {
      const name = this.addCharacter(cue.name);
      out.speaker = name; out.extension = cue.extension; this.lastSpeaker = name; this.lastActor = name; this.sawContent = true;
      if (cue.inline) { const q = cue.inline.match(/^[“"„«](.*?)[”"»]?\.?$/); out.dialogue = q ? q[1] : cue.inline; return finish('dialogue', 'body'); }
      return finish('cue', 'cue');
    }
    const says = text.match(/^([\p{L}][\p{L} .'-]{0,35}?)\s+(?:sanoo|vastaa|kysyy|huutaa|kuiskaa|toteaa|says|replies|asks|shouts|whispers|adds)(?:\s*[:,])?\s*[“"„«](.*?)[”"»]?\s*(\d+(?:[.,]\d+)?\s*s)?\.?$/iu);
    if (says) {
      const who = this.resolveActor(says[1], language) ?? this.addCharacter(says[1]);
      out.speaker = who; out.dialogue = says[2]; this.lastActor = who; this.lastSpeaker = who; this.sawContent = true;
      return finish('dialogue', 'body');
    }

    // Kamera / kuvakoko / kuvakulma.
    const cutTo = text.match(/^CUT\s+TO\s+([^.:]+)[.:]?$/i);
    if (cutTo && !this.resolveActor(cutTo[1].trim().split(/\s+/)[0], language)) { out.transition = 'cut'; out.clauses = [{ type: 'title-card', value: cutTo[1].trim(), text }]; this.sawContent = true; return finish('transition', 'body'); }
    // "CLOSE-UP on Mira. She raises an eyebrow." / "Wide shot. MIRA stands…": kuva + ohje samalla rivillä.
    const sentences = text.split(/(?<=[.!?])\s+/);
    if (sentences.length > 1) {
      const head = this.shots(sentences[0].replace(/[.!?]$/, ''), language);
      if (head) { out.shot = head; out.clauses = this.clauses(sentences.slice(1).join(' '), language); this.sawContent = true; return finish(out.clauses.every(c => c.type !== 'unknown') ? 'shot' : 'unknown', 'body'); }
    }
    const shots = this.shots(text, language);
    if (shots) { out.shot = shots; this.sawContent = true; return finish('shot', 'body'); }

    // Väliotsikko ilman puhujaa ("Kun kysely alkaa:", "Ending:").
    if (/:$/.test(text) && words(text).length <= 6) { out.clauses = [{ type: 'note', text }]; return finish('direction', 'body'); }
    // Johdantoproosa ennen ensimmäistä kohtausta tai repliikkiä on esipuhetta, ei ohjetta.
    if (this.state === 'header' && !this.sawContent) {
      const probe = this.clauses(text, language);
      if (!probe.length || probe.every(c => c.type === 'unknown' || c.type === 'note')) return finish('comment', 'header');
    }
    // Ohjerivi: jaetaan lauseiksi ja tunnistetaan.
    this.sawContent = true;
    out.clauses = this.clauses(text, language);
    const kind: LineKind = out.clauses.length && out.clauses.every(c => c.type !== 'unknown') ? 'direction' : 'unknown';
    return finish(kind, 'body');
  }

  /** Ohjerivi puhujan jälkeen: lause alkaa nimetyllä hahmolla/pronominilla tai tunnetulla ohjesanalla ja tunnistuu kokonaan. */
  private isExplicitDirection(text: string, language: ScriptLanguage): boolean {
    const first = words(text)[0] ?? '';
    const startsWithActor = this.resolveActor(first, language) !== undefined;
    const startsWithVerb = [...motionRules, ...expressionRules].some(r => r.fi?.test(first) || r.en?.test(first)) || gazeVerb.fi.test(first) || gazeVerb.en.test(first);
    const directionWord = RX1.test(text);
    if (!startsWithActor && !startsWithVerb && !directionWord) return false;
    const saved = { lastActor: this.lastActor, lastGaze: this.lastGaze };
    const probe = this.clauses(text, language, this.lastActor);
    this.lastActor = saved.lastActor; this.lastGaze = saved.lastGaze;
    return probe.length > 0 && probe.every(c => c.type !== 'unknown');
  }

  private looksLikeDirection(text: string): boolean {
    if (this.cueName(text, '')) return true;
    if (sceneHeadingRe.test(text) || timecodeRe.test(text) || transitionRe.test(text)) return true;
    return this.shots(text, detectLanguage(text)) !== undefined;
  }

  private shots(text: string, language: ScriptLanguage): RecognizedLine['shot'] | undefined {
    const strict = text.match(/^(?:Kamera|Camera)\s*:\s*(.+)$/i);
    const cut = text.match(/^(?:CUT(?:\s+TO)?|LEIKKAUS(?:\s+HAHMOON)?|Leikkaus|Cut)\s*:?\s+(.+?)\.?$/i);
    const loose = !!(strict || cut);
    const body0 = strict?.[1] ?? cut?.[1] ?? text;
    const body = loose ? upper(body0) : body0;
    const seq = body.split(/\s*(?:→|->)\s*/);
    if (!strict && !cut && seq.length > 1 && seq.every(part => this.resolveActor(part.trim()) !== undefined)) {
      const result = seq.map(part => ({ size: 'medium' as ShotSize, target: this.resolveActor(part.trim())! }));
      this.lastActor = result.at(-1)!.target; return result;
    }
    const hasShot = shotWords.some(([re]) => re.test(body)) || moveWords.some(([re]) => re.test(body)) || angleWords.some(([re]) => re.test(body));
    if (!strict && !cut && !hasShot) return undefined;
    // Pitkä proosa, jossa sattuu olemaan "pan" tms., ei ole kuvarivi: vaaditaan isot kirjaimet tai lyhyt rivi.
    if (!strict && !cut && words(body).length > 9 && !/^[\p{Lu}\d\s→>.,:()\/-]+$/u.test(body.split(/[—–]/)[0])) return undefined;
    const parts = body.split(RX2).filter(Boolean);
    const result: NonNullable<RecognizedLine['shot']> = [];
    for (const part of parts) {
      const size = shotWords.find(([re]) => re.test(part))?.[1];
      const move = moveWords.find(([re]) => re.test(part))?.[1];
      const angle = angleWords.find(([re]) => re.test(part))?.[1];
      const target = this.actorIn(words(part), language).actor;
      if (!size && !move && !angle && !target) continue;
      result.push({ ...(size ? { size } : cut && !size ? { size: 'medium' as ShotSize } : {}), ...(target ? { target } : {}), ...(move ? { move } : {}), ...(angle ? { angle } : {}) });
      if (target) this.lastActor = target;
    }
    return result.length ? result : undefined;
  }

  /** Lauseet: piste/puolipiste/rivinvaihto, sekä "ja"/"and"/"sitten"/"then" kun molemmilla puolilla on verbi. */
  clauses(text: string, language: ScriptLanguage, defaultActor = ''): Clause[] {
    const sentences = text.split(/(?<=[.!?;])\s+|\s*;\s*/).flatMap(s => s.split(/,?\s+(?:ja sitten|sitten|and then|then)\s+/i)).map(s => s.trim()).filter(Boolean);
    const out: Clause[] = [];
    for (const sentence of sentences) {
      const parallel = RX3;
      const s = sentence.replace(parallel, '').replace(/[.!?]+$/, '').trim();
      if (!s) continue;
      // Yhteinen subjekti: "Kille ja Handu kävelevät oikealle", "Mira and Niko nod".
      const compound = this.compoundSubject(s, language);
      if (compound) { for (const who of compound.actors) { const c = this.clause(compound.rest, language, who); out.push('actor' in c ? { ...c, actor: who } as Clause : c); } continue; }
      const found = this.clause(s, language, defaultActor);
      const extra = this.modifiers(s, language, found);
      // "Kille kävelee ja vilkuttaa" → kaksi liikettä samalle hahmolle.
      if (found.type === 'motion' || found.type === 'gaze' || found.type === 'expression') {
        const joined = s.split(/\s+(?:ja|and)\s+/i);
        if (joined.length > 1) { const first = this.clause(joined[0], language, defaultActor); const actor = 'actor' in first ? first.actor : defaultActor; out.push(first, ...joined.slice(1).map(j => this.clause(j, language, actor))); continue; }
      }
      out.push(found, ...extra);
    }
    return out;
  }

  private compoundSubject(s: string, language: ScriptLanguage): { actors: string[]; rest: string } | undefined {
    const ws = s.split(/\s+/);
    const verbAt = ws.findIndex(w => anyVerbFi.test(lower(w).replace(/[.,!?]/g, '')) || anyVerbEn.test(lower(w).replace(/[.,!?]/g, '')));
    if (verbAt < 3) return undefined;
    const head = ws.slice(0, verbAt).map(w => w.replace(/,$/, '')).filter(w => !/^(ja|and|sekä|&)$/i.test(w));
    const actors = head.map(w => this.resolveActor(w, language));
    if (actors.length < 2 || actors.some(a => !a || a === ALL_ACTORS)) return undefined;
    return { actors: [...new Set(actors as string[])], rest: ws.slice(verbAt).join(' ') };
  }

  /** Lisäilme toiminnan rinnalla: "katsoo puhelintaan huolestuneena", "walks in angrily". */
  private modifiers(s: string, language: ScriptLanguage, primary: Clause): Clause[] {
    if (!['motion', 'gaze', 'phone'].includes(primary.type) || !('actor' in primary)) return [];
    const ws = this.positive(words(s));
    for (const rule of expressionRules) if (ws.some(w => (language !== 'en' && rule.fi?.test(w)) || (language !== 'fi' && rule.en?.test(w)))) {
      if (rule.value === 'dead_stare' && primary.type === 'gaze' && !/^(tuijott|stare)/.test(ws.find(w => rule.fi?.test(w) || rule.en?.test(w)) ?? '')) continue;
      return [{ type: 'expression', actor: primary.actor, value: rule.value, text: s }];
    }
    return [];
  }

  /** Poistaa kiellon alaiset sanat: "ei vihaiselta", "not angry", "mutta ei". */
  private positive(ws: string[]): string[] {
    return ws.filter((_, i) => !ws.slice(Math.max(0, i - 2), i).some(w => /^(ei|eikä|en|et|emme|ette|eivät|not|never|no|without|ilman|isn't|doesn't|don't)$/.test(w)));
  }

  private clause(s: string, language: ScriptLanguage, defaultActor = ''): Clause {
    const ws = words(s), low = lower(s);
    const verbAt = ws.findIndex(w => anyVerbFi.test(w) || anyVerbEn.test(w));
    const found = this.actorIn(verbAt >= 0 ? ws.slice(0, verbAt) : ws, language);
    const subject = found.actor ? found : verbAt >= 0 ? { index: -1 } as { actor?: string; index: number } : found;
    const actor = subject.actor ?? (defaultActor || this.lastActor);
    if (subject.actor && subject.actor !== ALL_ACTORS && subject.index <= 1) this.lastActor = subject.actor;
    const duration = parseDuration(s);
    const isFi = language !== 'en', isEn = language !== 'fi';
    const pos = this.positive(ws);
    const has = (re?: RegExp, also?: RegExp) => pos.some(w => (re && isFi && re.test(w)) || (also && isEn && also.test(w)));

    // Rajoitukset ja kiellot ensin ("Ei isoa elettä", "Do not move").
    if (RX4.test(s)) {
      const value = /kameraliik|kamera\p{L}*|camera/iu.test(s) && /liik|liiku|move|movement|motion|pan|zoom/i.test(s) ? 'camera-still' : /ei dialogia|no dialogue|no lines/i.test(s) ? 'no-dialogue' : RX5.test(s) ? 'still' : /dissolve|ristikuva|häivytys/i.test(s) ? 'hard-cuts' : /ylimäär|extra props|taustakama/i.test(s) ? 'no-extra-props' : /ele|gesture|animaatio|animation/i.test(s) ? 'small-gestures' : 'other';
      return { type: 'constraint', actor: subject.actor ?? 'scene', value, text: s };
    }
    if (/^(huom|note|animaatio|animation|vinkki|tip)\s*:/i.test(s)) return { type: 'note', text: s };
    // Kielto lauseen keskellä: "Mira ei liiku", "Niko pysyy paikallaan", "Mira does not move".
    if (/(?<![\p{L}])(ei liiku|ei liikahda|ei liikuta|pysyy paikallaan|pysyy liikkumatta|jähmettyy|does not move|doesn't move|stays still|remains still|freezes|froze)(?![\p{L}])/iu.test(s)) return { type: 'constraint', actor: subject.actor ?? (actor || 'scene'), value: 'still', text: s };

    // Leikkauksen rytmi ja siirtymät ("Leikkausrytmi nopeutuu", "Hard cut lähes kaikkialla", "hidastaa hetkeksi").
    if (RX6.test(s) || (RX7.test(s) && !subject.actor)) {
      const value = /nopeutu|speeds? up|faster/i.test(s) ? 'faster' : /hidast|slows? down|slower/i.test(s) ? 'slower' : /hard cut|leikkaus.*kaikkialla|ei dissolve/i.test(s) ? 'hard-cuts' : 'rhythm';
      return { type: 'editing', value, text: s };
    }
    // Ympäristö ja otsikkokortti.
    const env = s.match(/^(?:Tausta|Background|Miljöö|Setting)\s*:\s*(.+)$/i);
    if (env) return { type: 'environment', value: env[1].replace(/\s+\d+(?:[.,]\d+)?\s*s$/, '').trim(), text: s };
    const title = s.match(/^(?:Otsikkokortti|Title card|TITLE|SUPER|Teksti ruudulla|On-screen text|Lopetus|Ending)\s*:\s*(.+)$/i);
    if (title) return { type: 'title-card', value: title[1].replace(/\s+\d+(?:[.,]\d+)?\s*s$/, '').trim(), seconds: duration?.seconds, text: s };

    // Tauot ("Pieni tauko.", "Beat.", "Pidä 0,5 s Handun ilmeessä", "Tähän ei dialogia noin 0,5 sekuntiin").
    if (RX8.test(s) || (duration && RX9.test(s))) {
      const seconds = duration?.seconds ?? (RX10.test(s) ? 0.5 : RX11.test(s) ? 1.5 : undefined);
      const value = /ei dialogia|no dialogue|hiljaisuus|silence/i.test(s) ? 'silence' : /ilmee|ilmeessä|stare|tuijot/i.test(s) ? 'dead_stare' : 'pause';
      return { type: 'hold', actor: subject.actor ?? (actor || 'scene'), value, seconds, text: s };
    }

    // Puhelin (ennen katsetta: "katsoo puhelinta" on puhelinkatse).
    const phone = has(phoneNoun.fi, phoneNoun.en);
    if (phone) {
      if (has(gazeVerb.fi, gazeVerb.en)) { this.lastGaze = 'phone'; return { type: 'gaze', actor, target: 'phone', text: s }; }
      const value: PhoneAction | 'phone-on' | 'phone-off' | undefined =
        /siirtää.*kä|vaihtaa.*käteen|transfer|switch(?:es)? hands?/i.test(s) ? 'phone_transfer'
        : RX12.test(s) ? 'phone_ear'
        : RX13.test(s) ? 'phone_tap'
        : /pöydälle|laskee|put(?:s)? (?:the |a )?phone down|on the table|lowers/i.test(s) ? 'phone_down'
        : /näyttää.*kamera|shows?.*camera/i.test(s) ? 'phone_camera'
        : /näyttää|näyttävät|shows?|showed|showing|holds? up/i.test(s) ? 'show_phone'
        : /ottaa .*esiin|ottaa esille|kaivaa|takes out|pulls out|esille/i.test(s) ? 'phone-on'
        : /laittaa .*taskuun|pois|puts? (?:it |the phone )?away|pockets/i.test(s) ? 'phone-off'
        : /pitää|pitelee|holds?|holding|kädessä|käteensä|with (?:his|her|their|a|the) (?:phone|cellphone)|on \p{L}+ kädessä/iu.test(s) || RX14.test(low) ? 'phone_hold'
        : undefined;
      if (value) return { type: 'phone', actor, value, text: s };
    }

    // Katse.
    if (has(gazeVerb.fi, gazeVerb.en)) {
      const rest = ws.slice(Math.max(0, ws.findIndex(w => gazeVerb.fi.test(w) || gazeVerb.en.test(w))) + 1);
      const other = rest.map(w => this.resolveActor(w, language)).find(a => a && a !== actor);
      if (other) { this.lastGaze = other; return { type: 'gaze', actor, target: other, ...(duration ? { seconds: duration.seconds } : {}), text: s }; }
      if (rest.some(w => cameraNoun.fi.test(w) || cameraNoun.en.test(w))) return { type: 'gaze', actor, target: 'camera', ...(duration ? { seconds: duration.seconds } : {}), text: s };
      if (RX15.test(s) && this.lastGaze) return { type: 'gaze', actor, target: this.lastGaze, text: s };
      // "Kille katsoo puhelintaan hieman huolestuneena" → katse + ilme käsitellään omana lauseenaan alempana.
    }

    // Paikallaanolo: "seisoo", "stands" – lavastusta, ei liikettä.
    if (has(/^(seisoo|seisoi|seisovat|odottaa|odotti|istuu\s+jo)$/u, /^(stands|stood|standing|waits|waiting)$/) && !motionRules.some(r => has(r.fi, r.en))) return { type: 'note', text: s };

    // Liikkeet.
    for (const rule of motionRules) {
      if (!has(rule.fi, rule.en)) continue;
      if (rule.value === 'point' && isFi && /osoitte|osoitteen/.test(low)) continue;
      const from = (isFi && /(?<![\p{L}])vasemmalta(?![\p{L}])/u.test(low)) || (isEn && /\bfrom (?:the )?left\b/.test(low)) ? 'right' : (isFi && /(?<![\p{L}])oikealta(?![\p{L}])/u.test(low)) || (isEn && /\bfrom (?:the )?right\b/.test(low)) ? 'left' : undefined;
      const dir = from ?? directionRules.find(d => (isFi && d.fi.test(low.replace(/vasemmalta|oikealta|from (?:the )?(?:left|right)/g, ''))) || (isEn && d.en.test(low.replace(/from (?:the )?(?:left|right)/g, ''))))?.value;
      if (rule.value === 'walk' || rule.value === 'run') {
        const value = `${rule.value}-${dir ?? 'right'}` as ProductionMotion;
        return { type: 'motion', actor, value, seconds: duration?.seconds, estimated: !dir || !duration, text: s };
      }
      if (rule.value === 'surprise') return { type: 'motion', actor, value: 'react-surprise', seconds: duration?.seconds, estimated: !duration, text: s };
      if (rule.value === 'wave' && /reaktio|reaction/i.test(s)) return { type: 'motion', actor, value: 'react-wave', seconds: duration?.seconds, estimated: !duration, text: s };
      if (rule.value === 'nod' && /reaktio|reaction/i.test(s)) return { type: 'motion', actor, value: 'react-nod', seconds: duration?.seconds, estimated: !duration, text: s };
      return { type: 'motion', actor, value: rule.value, seconds: duration?.seconds, estimated: !duration, text: s };
    }
    if (RX16.test(s)) return { type: 'motion', actor, value: 'wave', seconds: duration?.seconds, estimated: !duration, text: s };
    if (RX17.test(s)) return { type: 'expression', actor, value: 'eyebrow_raise', text: s };

    // Ilmeet.
    for (const rule of expressionRules) if (has(rule.fi, rule.en)) return { type: 'expression', actor, value: rule.value, text: s };
    for (const rule of unsupportedExpressionRules) if (has(rule.fi, rule.en)) return { type: 'unsupported', actor, label: rule.label, text: s, reason: `Ilme “${rule.label}” tunnistettiin, mutta sitä ei ole hahmopaketeissa.` };

    if (has(gazeVerb.fi, gazeVerb.en)) {
      const rest = ws.slice(ws.findIndex(w => gazeVerb.fi.test(w) || gazeVerb.en.test(w)) + 1);
      const other = rest.map(w => this.resolveActor(w, language)).find(Boolean);
      if (other && other !== actor) return { type: 'gaze', actor, target: other, text: s };
    }
    return { type: 'unknown', text: s };
  }

}

/** Lauseen alun sanat, jotka eivät koskaan ole hahmon nimiä (ohjerivien hahmolöytö). */
const nonActorStarters = new Set(['sitten', 'samalla', 'nyt', 'lopuksi', 'yhtäkkiä', 'äkkiä', 'hetken', 'kamera', 'kuva', 'tausta', 'musiikki', 'ääni', 'kaikki', 'molemmat', 'kumpikin', 'joku', 'kukaan', 'hän', 'he', 'se', 'ne', 'tämä', 'tuo', 'ja', 'mutta', 'kun', 'jos', 'ei', 'älä', 'huom', 'leikkaus', 'kohtaus', 'jakso',
  'täysin', 'hyvin', 'hieman', 'vähän', 'todella', 'aivan', 'hitaasti', 'nopeasti', 'hiljaa', 'varovasti', 'vihdoin', 'taas', 'jälleen', 'very', 'slowly', 'quickly', 'really', 'just', 'still', 'again', 'quietly', 'carefully',
  'then', 'meanwhile', 'suddenly', 'finally', 'now', 'camera', 'the', 'a', 'an', 'everyone', 'everybody', 'someone', 'somebody', 'nobody', 'he', 'she', 'they', 'it', 'we', 'i', 'you', 'and', 'but', 'when', 'if', 'no', 'not', 'cut', 'scene', 'episode', 'music', 'sound', 'background']);
/**
 * Puhumattomat hahmot ohjeriveiltä: rivin ensimmäinen sana on isolla alkukirjaimella kirjoitettu nimi,
 * jota seuraa suoraan tunnettu toimintaverbi ("Niko kävelee", "Mom waves"). Suljettu sääntö, ei arvausta.
 */
export function discoverActors(lines: string[]): string[] {
  const found: string[] = [];
  const lowerWords = new Set(lines.flatMap(l => l.match(/(?<![\p{L}])[\p{Ll}][\p{L}'-]*/gu) ?? []));
  for (const raw of lines) {
    const t = cleanLine(raw);
    if (!t || /^[\p{Lu}\d\s.'’:()\/-]+$/u.test(t) || /:/.test(t.split(/\s+/)[0] ?? '')) continue;
    const m = t.match(/^([\p{Lu}][\p{Ll}][\p{L}'-]{0,30})\s+([\p{L}]+)/u);
    // Sana, joka esiintyy muualla pienellä alkukirjaimella, on tavallinen sana eikä nimi ("Täysin" / "täysin").
    if (!m || nonActorStarters.has(lower(m[1])) || lowerWords.has(lower(m[1]))) continue;
    const verb = lower(m[2]);
    if (anyVerbFi.test(verb) || anyVerbEn.test(verb) || /^(seisoo|seisoi|tulee|tuli|astuu|astui|odottaa|odotti|pitää|pitelee|stands|enters|entered|waits|waited|holds)$/u.test(verb)) {
      const n = normalizeName(m[1]);
      if (!found.includes(n)) found.push(n);
    }
  }
  return found;
}

/** Koko käsikirjoitus: esiskannaus (puhujat, hahmot) + rivitilakone. */
export function recognizeScript(text: string, characters: string[] = [], options: { discoverActors?: boolean } = {}): RecognizedScript {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const r = new ScriptRecognizer(characters);
  const following = nextNonEmpty(lines);
  r.prescan(lines, following);
  if (options.discoverActors) for (const n of discoverActors(lines)) r.addCharacter(n);
  const out: RecognizedLine[] = [];
  for (let i = 0; i < lines.length; i++) out.push(r.recognize(lines[i], i + 1, following[i]));
  const content = out.filter(l => l.kind !== 'empty');
  const unknown = content.filter(l => l.kind === 'unknown').length;
  return {
    language: detectLanguage(text),
    characters: r.knownCharacters,
    lines: out,
    stats: { lines: out.length, content: content.length, recognized: content.length - unknown, unknown, percent: content.length ? Math.round(((content.length - unknown) / content.length) * 1000) / 10 : 100 },
  };
}

/** Lyhyt suomenkielinen kuvaus marginaaliin ja diagnostiikkaan. */
export function describeLine(l: RecognizedLine): string {
  const motion: Record<string, string> = { 'walk-left': 'kävely ←', 'walk-right': 'kävely →', 'walk-front': 'kävely ↓', 'run-left': 'juoksu ←', 'run-right': 'juoksu →', 'run-front': 'juoksu ↓', wave: 'vilkutus', point: 'osoitus', fist: 'nyrkki', sit: 'istuminen', jump: 'hyppy', crouch: 'kyykky', nod: 'nyökkäys', 'react-nod': 'reaktio: nyökkäys', 'react-surprise': 'reaktio: hämmästys', 'react-wave': 'reaktio: vilkutus', stop: 'pysähdys' };
  const expr: Record<string, string> = { angry: 'vihainen', worried: 'huolestunut', confused: 'hämmentynyt', mildly_hurt: 'loukkaantunut', dead_stare: 'pokerinaama', eyebrow_raise: 'kulmat ylös', happy: 'iloinen', sad: 'surullinen', scared: 'peloissaan' };
  const fmt = (n?: number) => n === undefined ? '' : ` ${String(n).replace('.', ',')} s`;
  switch (l.kind) {
    case 'scene-heading': return 'Kohtaus';
    case 'timecode': return 'Kohtaus (aika)';
    case 'transition': return 'Siirtymä';
    case 'shot': return 'Kuva: ' + (l.shot ?? []).map(s => [s.size === 'close' ? 'lähikuva' : s.size === 'medium' ? 'puolikuva' : s.size === 'wide' ? 'laaja' : '', s.move ?? '', s.angle ?? '', s.target ?? ''].filter(Boolean).join(' ')).join(' → ');
    case 'cue': return 'Puhuja';
    case 'dialogue': return 'Repliikki';
    case 'parenthetical': return 'Repliikin ohje';
    case 'metadata': return 'Tieto';
    case 'character-decl': return 'Hahmo';
    case 'comment': return 'Kommentti';
    case 'strict-header': return 'Tiukka tila';
    case 'unknown': return 'Ei tunnistettu';
    case 'direction': return l.clauses.map(c => c.type === 'motion' ? motion[c.value] + fmt(c.seconds) : c.type === 'expression' ? 'ilme: ' + expr[c.value] : c.type === 'gaze' ? 'katse → ' + (c.target === 'phone' ? 'puhelin' : c.target === 'camera' ? 'kamera' : c.target) : c.type === 'phone' ? 'puhelin' : c.type === 'hold' ? 'tauko' + fmt(c.seconds) : c.type === 'constraint' ? 'rajoitus' : c.type === 'environment' ? 'tausta' : c.type === 'title-card' ? 'otsikkokortti' : c.type === 'unsupported' ? c.label + ' (ei toteutettu)' : c.type === 'note' ? 'huomio' : c.type === 'editing' ? 'leikkaus' : '?').join(' · ');
    default: return '';
  }
}
