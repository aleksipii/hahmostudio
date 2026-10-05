# KILSAT Studio 0.33

Piirtotilan uusille muodoille reunaviivan näkyvyys. Valitulle suorakulmiolle, ellipsille ja polulle Näytä reunaviiva, viivan väri/leveys sekä nykyinen täyttöväri. Muutokset kulkevat nykyisen projektikomennon ja undo-historian kautta. Viivan leveys 0 säilyy .hahmo-tiedostossa. PNG/PSD:n valmiiksi rasteroiduilla viivoilla ei ole erillistä vektoriviivan asetusta; niitä muokataan pyyhekumilla/maskilla.

Kille/Handu-hahmoista poistettu ylimääräisen helmasuorakulmion ääriviiva ja taskusuorakulmio. PSD/.hahmo-pohjat uudelleenrakennettu ja tallennus/avaus tarkistettu. Vanhoja projekteja ei muuteta automaattisesti.

Uusi paikallinen Kilometrikirja-video käyttää kahdeksaa alkuperäistä käyttäjän repliikkiääntä ja alkuperäisiä Rhubarb-suuajoituksia. Suomenkieliset tekstitykset. Video/äänet eivät sisälly GitHubiin tai yleiseen sovelluspakettiin. Uusi video on erillinen esimerkki; Kokeile-painikkeen vanha esimerkki säilyy.

0.32:n fps- ja React-päivityssilmukan avoimet ongelmat eivät ole tällä muutoksella korjattu. Ei väitettä fyysisen laitteen tai puhtaan Macin graafisen käynnistyksen testauksesta.

## Tarkistus
876/876 kooditestiä, TypeScript, ARM64 Mac-paketointi, codesign ja paketoidun Electron/Node-runtimen testi läpäisivät. PSD/.hahmo-hahmopohjat avaustarkistettu. Videon H.264/AAC-purkaus onnistui: 357 ruutua, 24 fps, 14,875 s, 1080×1920. Ääniraidan FFmpeg mean_volume -19,7 dB ja max_volume -0,5 dB; nämä eivät ole LUFS/true-peak-mittauksia. Graafinen paketin käynnistys ja fyysiset laitteet eivät sisälly tähän varmennukseen.
