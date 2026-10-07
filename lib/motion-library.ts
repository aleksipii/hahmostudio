/**
 * Liikekirjasto (vaihe C): ammattimaiset liikeradat leikkaushahmoille.
 *
 * - Eleet koostuvat vaiheista ennakointi → toiminta → jälkiliike → asettuminen; jokaisella vaiheella on oma
 *   Bezier-käyränsä (`easing-model.ts`). Vaiheiden rajoilla liike kääntyy, joten nopeus on niissä nolla ja jatkuva.
 * - Päällekkäinen toiminta: johtava osa alkaa ensin, muut 2–4 ruudun porrastuksella (pää, kädet, vartalo eivät
 *   ala samassa ruudussa). Kyynärpää ja ranne kulkevat kaarella, koska liike on nivelkiertoa ketjussa.
 * - Liike alkaa nykyisestä asennosta (edellisen liikkeen loppu) eikä nolla-asennosta.
 * - Kävely, juoksu, istuminen, kyykky ja hyppy ratkaistaan analyyttisellä kahden luun IK:lla: tukijalka on
 *   lukittu maailmaan (ei liukumista) etu- ja sivunäkymässä. Askelpituus suhteutetaan jalan pituuteen ja
 *   kävelymatka keston mukaan.
 * Avaimet kirjoitetaan tiheinä (yksi per ruutu), jotta käyrien muoto säilyy sellaisenaan.
 */
import {sampleBezierCurve,type BezierCurve} from './easing-model.ts';
import {sampleTrack,neutral,type Animation,type Keyframe,type Pose} from './animation-model.ts';
import {solveTwoBone} from './inverse-kinematics.ts';
import type {QuickProfile} from './quick-animation.ts';
import type {CharacterView} from './character-view.ts';
// Moduulit: motion/core (avainkirjoitin, pehmennys), gestures (eleet), gait (IK-askellus), lower-body (istuminen, kyykky, hyppy), idle (lepoelämä).
export * from './motion/gestures.ts';
export * from './motion/gait.ts';
export * from './motion/lower-body.ts';
export * from './motion/idle.ts';
