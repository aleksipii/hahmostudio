# Auditointi 12.10.2026

Lähde: 4c37a41 + päähaaran 8f582d5 dokumentaatio, eristetty työhaara codex/audit-2026-10-12.

- npm test normaalissa testipalvelimet sallivassa ympäristössä: 1402/1402, ei ohituksia. Sandbox-ajo epäonnistui, eikä sitä lasketa hyväksynnäksi.
- npm run typecheck ja npm run desktop:build: läpi.
- HAHMOSTUDIO_AUDIO_ACCEPTANCE=1 npm run desktop:test:workflow: 27 tarkistusta läpi, lähde-Electron, 6 vaihetta kahdella leveydellä, generoitu ääni, PCM/ajoitus/suu/undo/redo/reload-palautus. Ei renderer-virheitä.
- node scripts/control-inventory.mjs: 732 JSX-hallintamäärittelyä, 313 HTML-painiketta. Myös role-elementit lasketaan; eri rajaus kuin aiempi 654. Inventointi ei suorita toimintoja. Kaikki lähdemäärittelyt merkitään unverified, kunnes ne on yhdistetty erilliseen toimintatestiin. Natiivit valikot eivät kuulu tähän inventointiin.

Edellisen /private/tmp/hahmostudio-audit-20261010-kansion työtä tai full-audit-haaraa ei löytynyt paikallisesti tai GitHubista. Aiemmin raportoitua 79 GUI-skenaariota ei käytetä tämän lähteen hyväksyntänä.

Koodihavainnot (korjaamatta): editor.tsx commitSource vertaa undefined presentationSourcea suoraan tyhjään tekstiin; saveDisabled ei vastaa downloadProjectin sourceDirty/recording-estoja. Tarkista käyttäytyminen erillisellä GUI-testillä ennen korjausten hyväksymistä.

Avoinna: MP4-viennin tulos erillisessä lokissa; Kokoro IPC:n uusi ajo; runtime-paketointi ja DMG; palikoiden raahaus/Alt-pudotus; kattava painikekohtainen toiminta; fyysiset laitteet, ihmisen kuunteluhyväksyntä ja VoiceOver. Ei 100 prosentin toimivuuslupausta.

MP4 end-to-end valmistui hyväksytysti: export-report.json ja export.txt. Oikea VideoToolbox H.264 1080×1920 30 fps, AAC 48 kHz, 10 s; ei Kokoro-synkan hyväksyntä.
