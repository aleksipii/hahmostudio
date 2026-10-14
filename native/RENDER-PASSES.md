# Software 3D → layered PSD

Vienti-välilehdellä säädetään AO-näytteet/voimakkuus/säde ja syvyyskartan
etäisyysrajat. **Renderöi tasoiksi** avaa nykyisen ruudun kuutena muokattavana
tasona Kuva-työtilaan. Nykyinen kuva korvautuu; yhteinen Kumoa palauttaa sen.
Jos jakso tai kuva muuttuu työn aikana tai työ peruutetaan, vanha kuva säilyy.
Asetukset ja muokatut tasot tallentuvat .koeta-projektiin ja palautuvat avauksessa.
Kuva-välilehden **Vie PSD** vie muokatut tasot/maskit/ryhmät; se ei kopioi
vanhoja PSD-lähdetavuja tuloksena. Kirjoituksen peruutus ennen commitia säilyttää
vanhan kohdetiedoston.

Myös **Tiedosto → Vie nykyinen 3D-ruutu PSD-passeina…** käyttää näitä asetuksia. The export freezes the
current posed scene, camera, frame and publication dimensions. Software ray
tracing runs on a background thread; cancellation preserves an existing target.
It does not burn subtitles or raster outlines into the geometry passes.
Raster-only painted contact-shadow decorations are excluded from all AOVs.

Layers, from bottom to top:

| Layer | Pixels / Photoshop composition |
| --- | --- |
| Background | Opaque scene clear colour |
| Diffuse / Base Color | Interpolated mesh base colour, sRGB, no lighting |
| Ambient Occlusion | Cosine-weighted finite-radius visibility; Multiply |
| Specular | Shadow-tested directional Blinn–Phong highlights; Screen |
| Depth Map | Radial camera distance, near white / far black; hidden |
| Normal Map | Face-forward world-space XYZ mapped from −1…1 to RGB; hidden |

Geometry pixels share the same hit and alpha coverage. Background has alpha255;
misses in other passes have alpha0. Depth defaults: near0.05m, far100m; these remap only depth values, not
geometry clipping. AO-strength0 keeps the AO pass white. Configure
`RayTraceOptions` for useful lens-blur range. AO defaults:8 deterministic samples,
0.3m radius. Utility layers must be enabled explicitly for inspection. The merged
PSD preview combines base×AO plus Screen specular; it is not the cel rasterizer's
beauty pass or physically based global illumination.

`hs-render::raytrace` skins the existing indexed meshes once, builds a bounded
median-split triangle BVH, and evaluates all passes together. Up to8 standard Rust
worker threads by default; results do not depend on thread count. Limits:
4million pixels for ray tracing, dimensions≤30000, 200000 triangles,≤64 AO samples,
128MiB PSD output. Export temporarily allocates geometry and pass buffers;
none are retained by the idle studio.

The new rendering/writing path uses `glam`, standard Rust and Pure Rust crates;
it does not call WGPU or C/C++ bindings. WGPU remains the existing preview backend.
The wider application still has its existing audio/camera/platform dependencies.

**Crate limitation:** `psd`0.3.5 only reads PSDs; it has no exporter API.
`psd_exporter.rs` writes PSDv1 RGB8 RAW planar layers in Rust, then decodes with
`psd` and compares all six layer pixel buffers before atomic replacement.
That crate also reverses the visibility flag; tests independently verify correct
Photoshop hidden-layer flags with Koeta's PSD importer. Actual Photoshop and Mac
acceptance remain unrun. The encoder uses the PSD-specified flags.

Reproducible CPU-only example (no GPU feature required):

```sh
cargo run --locked -p hs-render --no-default-features \
  --example render_3d_psd -- /tmp/character-passes.psd
cargo test --locked -p hs-render --no-default-features --test raytrace_psd
```

Unsupported: transparency/refraction, material textures, reflections/path tracing,
volumetrics, PSD16/32-bit or HDR. Mesh `color.a` is Koeta's outline weight,
not material transparency; generated AOV geometry is opaque.


## Kontaktit ja pilotti

[production-pilot.en.txt](examples/production-pilot.en.txt) on kahden hahmon
21s käsikirjoitus: puhe, kuvakulmat, mukin nosto ja kumartuminen lattialle
laskemiseen. Nykyiselle mug-mallille lattian tarttumispisteen y on0.137m;
se perustuu todellisen mesh-rajan pohjaan. `place cup at -0.25 0.137 0.50 3s`
pitää käden otteen ja nilkat/varpaat ankkuroituina, vapauttaa mukin lattiaan
ja palauttaa hahmon seisomaan. Kaukaista laskukohdetta ei arvata saavutettavaksi.
Lattialta poimimisen erillistä kumartumista ei ole vielä toteutettu.

Ympäristötarkistus käyttää todellisia staattisen lavasteen kolmioita ja ratkaistun
FK:n keho-/pää-/jalkakapseleita. Välimuistitettu BVH ja liikeradan pyyhkäisyt
estävät seinien läpäisyn myös näytteiden välissä. Törmäyksestä annetaan rivivirhe;
reittiä ei siirretä eikä hahmoa teleportata automaattisesti. Tämä ei ole täydellinen
keho-/vaate-/sormi-/hahmojen keskinäinen fysiikka. Dynaamisilla ovilla ja esineillä
on omat aiemmat kontaktitarkistuksensa. Aiemmin läpäisevä aloitusasento (esim.
auton penkin sisällä seisominen) voi nyt pysähtyä oikeaan törmäysvirheeseen.

```sh
cargo run --locked -p hs-cli -- render examples/production-pilot.en.txt   --cpu --test-speech --size 160x90 -o /tmp/koeta-pilot-test.mp4
```

`--test-speech` on nimenomaan testiääni, ei englanniksi puhuva Kokoro.
Testiviennissä puheen kesto mukautti pilotin23sekuntiin; H.264/AAC/englannin
mov_text-raita todettu. Hyväksytty englanninkielinen pilotti tarvitsee edelleen
Kokoro-puheen kuuntelun tai käyttäjän omat äänitykset ja myöhemmin oikean Macin.

Portable test project with retained audio, captions and editable render layers:

```sh
cargo run --locked -p hs-agents --example production_pilot -- /tmp/pilot-test.koeta
```

The example reopens the file without a synthesis engine and verifies the exact
mixed PCM samples. Its title and audio provenance explicitly identify TEST audio.
