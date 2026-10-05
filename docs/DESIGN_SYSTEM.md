# Hahmostudio v0.32 Design System

Rive-inspired design foundation for interactive animation authoring.

## Color Tokens

### Semantic Colors
- `--color-bg`: Main background
- `--color-surface`: Panel/card background
- `--color-border`: Divider and border color
- `--color-text`: Primary text
- `--color-text-secondary`: Secondary text (muted)
- `--color-accent`: Primary interaction color (Rive blue)

### Using Colors

```css
.my-component {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.my-button {
  background: var(--color-accent);
  color: #101519; /* Fixed contrast */
}
```

## Spacing Scale

8px base unit:
- `--space-1`: 4px (tight)
- `--space-2`: 8px (default gap)
- `--space-3`: 12px (section gap)
- `--space-4`: 16px (padding)
- `--space-5`: 20px (larger padding)
- ... up to `--space-12`: 64px

```css
.section {
  padding: var(--space-4); /* 16px */
  gap: var(--space-3);     /* 12px */
}
```

## Typography

### Font Sizes
- `--text-xs`: 11px (labels)
- `--text-sm`: 12px (captions)
- `--text-base`: 14px (body text)
- `--text-lg`: 16px (subheadings)
- `--text-xl`: 18px (headings)

### Font Weights
- `--font-normal`: 400 (body)
- `--font-medium`: 500 (labels)
- `--font-semibold`: 600 (headings)
- `--font-bold`: 700 (emphasis)

```css
.heading {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}
```

## Component Primitives

### Button
```tsx
<button className="button">Secondary</button>
<button className="button primary">Primary</button>
<button className="button ghost">Ghost</button>
```

### Input
```tsx
<input className="input" type="text" />
<select className="select"></select>
<textarea className="textarea"></textarea>
```

### Layout
```tsx
<div className="section">        {/* padding + gap */}
<div className="row">           {/* flex row */}
<div className="stack">         {/* flex column */}
<div className="card">          {/* border + surface */}
```

## State Machine Editor

New component for visual state graphs:

```tsx
import StateEditor from './components/state-editor';
import type { StateMachine } from './lib/state-machine-model';

const [machine, setMachine] = useState<StateMachine>(...);

<StateEditor
  machine={machine}
  onChange={setMachine}
  selectedStateId={selectedId}
  onSelectState={setSelectedId}
/>
```

## Easing Curves

New model for cubic Bezier interpolation:

```tsx
import { EASING_PRESETS, sampleBezierCurve } from './lib/easing-model';

// Apply easing to keyframe interpolation
const eased = applyEasing(startValue, endValue, t, easingCurve);

// Get preset curve
const curve = EASING_PRESETS.easeInOut.curve;
```

## Migration Guide

### From Old CSS to New Tokens

**Before:**
```css
color: #f0f1f1;
padding: 14px 20px;
border: 1px solid #333639;
```

**After:**
```css
color: var(--color-text);
padding: var(--space-4) var(--space-5);
border: 1px solid var(--color-border);
```

### Updating Components

1. Replace hardcoded colors with tokens
2. Use spacing scale instead of arbitrary px values
3. Use typography scale for font sizes/weights
4. Test with light/dark theme switcher

## Next Steps

1. **Wire state editor into animation workspace**
   - Add a new "Motion Logic" panel
   - Show state transitions alongside keyframes

2. **Add easing curve preview panel**
   - Interactive bezier handles
   - Preset buttons
   - Live curve visualization

3. **Integrate with animation timeline**
   - Link easing curves to keyframes
   - Show transition blending duration

4. **Documentation**
   - User guide for state machines
   - Easing curve best practices
   - Animation workflow examples

## Toteutettu integraatio: siirtymäkäyrät ja tilakone

Animointi → Liikkeet → Siirtymäkäyrä näyttää valitun tason nykyisen avainruudun käyrän. Valitse avainruutu aikajanan timantista. Linear, Ease In, Ease Out ja Ease In Out tallentavat Bézier-pisteet. CP1/CP2 toimivat osoittimella ja nuolinäppäimillä; Shift kasvattaa askelta. Esikatselun liukusäädin näyttää liikkeen osuuden. Pidä asento -ruudussa käyrän muokkaus on estetty; vaihda ensin siirtymätyyppi. Viimeisellä avainruudulla ei ole seuraavaa siirtymää.

Data kulkee `EasingEditor → commitAnimation → prepareEditorEdit → durable journal → Animation → sampleTrack`. Pisteen vedon aikana vain käyräpaneelin luonnos päivittyy; vapautus tallentaa yhden komennon. Nykyinen näyttämö päivittyy kuittauksen jälkeen. `Keyframe.bezierCurve` on valinnainen; vanhat linear/smooth/hold-projektit toimivat ennallaan. Tallennus, palautus ja undo käyttävät olemassa olevia projektipalveluita.

Liikelogiikka-paneelin `StateEditor` tarjoaa SVG-solmukaavion, tilojen nimet/radat/nopeudet, aloitustilan sekä siirtymien luomisen, kestot ja poistamisen. `Animation.stateMachine` on valinnainen ja validoitu. Se säilyy .hahmo-tiedostossa ja projektihistoriassa. **Tilakoneen runtime, ehdonmuokkaus ja blend-puiden toisto eivät kuulu tähän integraatioon.** Kaavio ei ohita nykyistä animaatiomoottoria.

Uusi app-shell CSS on rajattu `.motion-tools`-alueeseen, jotta vanha telakointi, näyttämön mitat ja laitteiden elinkaari säilyvät. Uudet paneelit käyttävät tokens.css:n väri-, typografia-, väli- ja kokotunnuksia; vaalea/tumma/järjestelmäteema säilyvät.

Varmennus: TypeScript, 292 kooditestiä sekä desktop:build onnistuvat. Buildin olemassa olevat suuren JS-paketin ja fflate-importtien varoitukset säilyvät. Graafista käyttöä tai fyysisiä laitteita ei testattu tässä muutoksessa; asennettu Mac-sovellus tarvitsee erillisen uudelleenpaketoinnin.

## 0.32: transport ja tiukka käsikirjoitus
Tilakoneen automaattinen kohtaus-transport on toteutettu erillisessä PlaybackControllerissa. SVG-liikelogiikan parametriohjattu blend-tree-runtime säilyy erillisenä jatkotehtävänä. Katso docs/tilakone.md.
