/** Templates contain only commands accepted by the strict Finnish grammar. */
export const scriptTemplates=[
 {id:'movement',name:'Liike ilman puhetta',description:'Yksi hahmo, ympäristö ja samanaikainen nyökkäys. Ei repliikkiääniä.',source:`#!kilsat
Hahmo: Kille
Kohtaus: Studio
Tausta: studio 0.5 s
Kamera: laaja 0.5 s
Kille kävelee oikealle 2 s
Samalla: Kille nyökkää 2 s
Kille vilkuttaa 2 s
Odota 1 s`},
 {id:'dialogue',name:'Kaksi hahmoa ja repliikit',description:'Valitse kummallekin hahmopohja ja tuo tai äänitä repliikkiäänet ennen rakentamista.',source:`#!kilsat
Hahmo: Kille
Hahmo: Handu
Kohtaus: Studio
Tausta: studio 0.5 s
Kamera: laaja 0.5 s
Kille sanoo: "Oletko valmis?" 2 s
Samalla: Kille vilkuttaa 2 s
Handu sanoo: "Nyt voidaan aloittaa." 2 s
Samalla: Kamera: lähikuva Handu 2 s
Odota 1 s`},
 {id:'camera',name:'Kuvakulmat ja ympäristö',description:'Kamera rajaa hahmon. Kohtaus vaihtuu nimetyllä rivillä; esineen kantaja on aina nimetty.',source:`#!kilsat
Hahmo: Kille
Kohtaus: Studio
Tausta: studio 0.5 s
Kamera: puolikuva Kille 1 s
Kille puhelin: esille 1 s
Kille katsoo: puhelin 2 s
Samalla: Kamera: lähikuva Kille 2 s
Kille puhelin: pois 0.5 s
Kohtaus: Olohuone
Tausta: olohuone 0.5 s
Kamera: laaja 1 s
Kille nyökkää 1 s`}
,
 {id:'english',name:'English · two characters',description:'Englanninkielinen rakenne. Repliikit tarvitsevat omat äänet.',source:`#!kilsat
Character: Kille
Character: Handu
Scene: Studio
Background: studio 0.5 seconds
Camera: wide 0.5 seconds
Kille walks right 2 seconds
Meanwhile: Handu waves 2 seconds
Kille says: "Are you ready?" 2 seconds
Handu says: "Let's begin." 2 seconds
Meanwhile: Camera: close-up Handu 2 seconds
Wait 1 second`},
 {id:'youtube-cutout',name:'YouTube · kartonkikohtaus',description:'KILSAT-cutout, resurssimanifesti, osoitus ja vihainen ilme. Liitä äänet ennen buildiä.',source:`#!kilsat
Resurssi tausta: cutout-studio-v1
Resurssi hahmo KILLE: kille
Resurssi hahmo HANDU: handu
Hahmo: Kille
Hahmo: Handu
Kohtaus: Studio
Tausta: studio 0.5 s
Kamera: laaja 0.5 s
Kille sanoo: "Kuule, tästä tulee hyvä jakso." 3 s
Samalla: Kille vilkuttaa 2 s
Handu sanoo: "Jos muistat äänittää repliikit." 3 s
Samalla: Handu osoittaa 2 s
Odota 1 s`}
] as const;
