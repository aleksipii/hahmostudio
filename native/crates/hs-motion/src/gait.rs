//! Parametrinen kävely- ja juoksusykli.
//!
//! Jalkaterän rata lasketaan hahmon paikallisessa koordinaatistossa niin, että
//! tukivaiheessa jalka liikkuu taaksepäin täsmälleen kehon nopeudella. Maailmassa
//! tukijalka pysyy siis paikallaan (ei liukumaa), ja polvi ratkaistaan IK:lla.
//! Juoksussa tukivaihe on alle puolet syklistä, joten mukana on lentovaihe.

use crate::humanoid::{Humanoid, Side};
use crate::ik;
use crate::skeleton::Pose;
use glam::{Quat, Vec3};
use serde::{Deserialize, Serialize};
use std::f32::consts::{PI, TAU};

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct GaitParams {
    /// Syklin taajuus (askelpareja sekunnissa).
    pub frequency: f32,
    /// Yhden syklin (kahden askeleen) pituus jalan pituuksina.
    pub stride: f32,
    /// Tukivaiheen osuus syklistä (kävely > 0,5, juoksu < 0,5 = lentovaihe).
    pub duty: f32,
    /// Lantion pystypomppu metreinä suhteessa jalan pituuteen.
    pub bounce: f32,
    /// Jalan nosto heilahdusvaiheessa suhteessa jalan pituuteen.
    pub lift: f32,
    /// Ylävartalon etukallistus (radiaaneina).
    pub lean: f32,
    /// Käsien heilunta (radiaaneina).
    pub arm_swing: f32,
    /// Kyynärpään perustaivutus (radiaaneina).
    pub elbow: f32,
    /// Lantion kiertymä pystyakselin ympäri (radiaaneina).
    pub pelvis_twist: f32,
    /// Olkapäiden vastakierto lantioon nähden (radiaaneina).
    pub shoulder_counter: f32,
    /// Sormien koukistus (0 = suora, 1 = nyrkki).
    pub fist: f32,
}

impl GaitParams {
    /// Vastaa TypeScript-version kävelyn jaksoa (1,1 s).
    pub fn walk() -> Self {
        GaitParams {
            frequency: 1.0 / 1.1,
            stride: 1.2,
            duty: 0.62,
            bounce: 0.025,
            lift: 0.12,
            lean: 0.04,
            arm_swing: 0.38,
            elbow: 0.25,
            pelvis_twist: 0.10,
            shoulder_counter: 0.16,
            fist: 0.25,
        }
    }
    /// Vastaa TypeScript-version juoksun jaksoa (0,62 s).
    pub fn run() -> Self {
        GaitParams {
            frequency: 1.0 / 0.62,
            stride: 1.9,
            duty: 0.33,
            bounce: 0.035,
            lift: 0.30,
            lean: 0.16,
            arm_swing: 0.85,
            elbow: 1.45,
            pelvis_twist: 0.16,
            shoulder_counter: 0.30,
            fist: 0.75,
        }
    }
    /// Kehon nopeus metreinä sekunnissa jalan pituudella `leg`.
    pub fn speed(&self, leg: f32) -> f32 {
        self.stride * leg * self.frequency
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct GaitSample {
    /// Lantion siirtymä lepoasennosta (paikallinen).
    pub pelvis_offset: Vec3,
    pub pelvis_yaw: f32,
    pub pelvis_roll: f32,
    pub chest_yaw: f32,
    pub lean: f32,
    /// Nilkan kohde hahmon paikallisessa koordinaatistossa (juuri = maa lantion alla).
    pub ankle_target: [Vec3; 2],
    /// Jalkaterän kallistus (radiaaneina, positiivinen = varpaat ylös).
    pub foot_pitch: [f32; 2],
    pub arm_pitch: [f32; 2],
    pub elbow: f32,
    pub fist: f32,
    /// Onko jalka tukivaiheessa.
    pub planted: [bool; 2],
}

fn smoothstep(x: f32) -> f32 {
    let x = x.clamp(0.0, 1.0);
    x * x * (3.0 - 2.0 * x)
}

/// Kuinka paljon lantiota lasketaan, jotta askel ylettyy polvi hieman koukussa.
fn pelvis_drop(h: &Humanoid, p: &GaitParams) -> f32 {
    let leg = h.leg(Side::Left);
    let limb = leg.thigh_len + leg.shin_len;
    let half = p.stride * h.pelvis_height() * p.duty * 0.5;
    let reach = (limb * limb - half * half).max(0.0).sqrt();
    // Kanta- ja varvasrullaus nostaa nilkkaa tukivaiheen päissä, joten lantion ei tarvitse laskea yhtä paljon.
    let roll = heel_toe_raise(h, 1.0);
    ((limb - reach) - roll).max(0.0) + limb * (0.012 + p.bounce * 0.5)
}

/// Nilkan nousu tukivaiheen päissä (0 keskellä, `edge` = 1 päissä).
fn heel_toe_raise(h: &Humanoid, edge: f32) -> f32 {
    h.leg(Side::Left).foot_len * 0.32 * edge * edge
}

/// Syklin näyte vaiheessa `phase` (0..1, kiertää).
pub fn sample(h: &Humanoid, p: &GaitParams, phase: f32) -> GaitSample {
    let leg_len = h.pelvis_height();
    let s = p.stride * leg_len * p.duty; // tukivaiheen matka
    let phase = phase.rem_euclid(1.0);
    let mut ankle_target = [Vec3::ZERO; 2];
    let mut foot_pitch = [0.0; 2];
    let mut planted = [false; 2];
    for side in Side::BOTH {
        let i = side as usize;
        let leg = h.leg(side);
        let x = side.sign() * h.proportions.hip_width * 0.5;
        let lp = (phase + if side == Side::Right { 0.5 } else { 0.0 }).rem_euclid(1.0);
        if lp < p.duty {
            let u = lp / p.duty;
            let edge = (u - 0.5).abs() * 2.0;
            ankle_target[i] =
                Vec3::new(x, leg.ankle_height + heel_toe_raise(h, edge), s * (0.5 - u));
            // Kantaisku alussa, varvasponnistus lopussa.
            foot_pitch[i] =
                0.25 * (1.0 - smoothstep(u * 5.0)) - 0.35 * smoothstep((u - 0.75) * 4.0);
            planted[i] = true;
        } else {
            let v = (lp - p.duty) / (1.0 - p.duty);
            let lift = p.lift * leg_len * (PI * v).sin();
            ankle_target[i] = Vec3::new(
                x,
                leg.ankle_height + heel_toe_raise(h, 1.0) + lift,
                s * (-0.5 + smoothstep(v)),
            );
            foot_pitch[i] = -0.35 * (1.0 - smoothstep(v * 3.0)) + 0.2 * smoothstep((v - 0.6) * 3.0);
        }
    }
    let drop = pelvis_drop(h, p);
    // Kävelyssä lantio korkeimmillaan keskituessa, juoksussa matalimmillaan (jousto).
    let wave = (2.0 * TAU * (phase - p.duty * 0.5)).cos();
    let bounce = p.bounce
        * leg_len
        * 0.5
        * if p.duty > 0.5 {
            wave - 1.0
        } else {
            -wave - 1.0
        };
    let sway = 0.012 * leg_len * (TAU * phase).sin() * (p.duty - 0.3).max(0.0) * 2.0;
    let swing = (TAU * phase).cos();
    GaitSample {
        pelvis_offset: Vec3::new(sway, -drop + bounce, 0.0),
        pelvis_yaw: p.pelvis_twist * swing,
        pelvis_roll: 0.04 * (TAU * phase).sin(),
        chest_yaw: -p.shoulder_counter * swing,
        lean: p.lean,
        ankle_target,
        foot_pitch,
        // Vasen käsi heilahtaa oikean jalan kanssa (positiivinen = taakse).
        arm_pitch: [p.arm_swing * swing, -p.arm_swing * swing],
        elbow: p.elbow,
        fist: p.fist,
        planted,
    }
}

/// Reverse locomotion while retaining forward-facing feet and knee poles.
/// A planted foot travels forward locally to cancel backward root translation.
pub fn reverse(g: &mut GaitSample) {
    for i in 0..2 {
        g.ankle_target[i].z = -g.ankle_target[i].z;
        g.foot_pitch[i] = -g.foot_pitch[i];
        g.arm_pitch[i] = -g.arm_pitch[i];
    }
    g.lean = -g.lean;
    g.pelvis_yaw = -g.pelvis_yaw;
    g.chest_yaw = -g.chest_yaw;
}

/// Kirjoittaa syklin asentoon. `root` on maa lantion alla (paikka ja kierto maailmassa).
pub fn apply(h: &Humanoid, pose: &mut Pose, g: &GaitSample, weight: f32) {
    let w = weight.clamp(0.0, 1.0);
    let sk = &h.skeleton;
    pose.translate[h.pelvis] += g.pelvis_offset * w;
    pose.local[h.pelvis] = Quat::from_rotation_y(g.pelvis_yaw * w)
        * Quat::from_rotation_z(g.pelvis_roll * w)
        * pose.local[h.pelvis];
    pose.local[h.spine] = Quat::from_rotation_x(g.lean * w * 0.6) * pose.local[h.spine];
    pose.local[h.chest] = Quat::from_rotation_y((g.chest_yaw - g.pelvis_yaw) * w)
        * Quat::from_rotation_x(g.lean * w * 0.4)
        * pose.local[h.chest];
    // Pää pysyy suunnassa: kumoa vartalon kierto ja kallistus.
    pose.local[h.neck] = Quat::from_rotation_y(-g.chest_yaw * w * 0.7)
        * Quat::from_rotation_x(-g.lean * w * 0.8)
        * pose.local[h.neck];
    for side in Side::BOTH {
        let i = side as usize;
        let arm = h.arm(side);
        // Kädet roikkuvat hieman sivulle, heiluvat ja kyynärpää koukistuu eteen.
        pose.local[arm.upper] = Quat::from_rotation_x(g.arm_pitch[i] * w)
            * Quat::from_rotation_z(side.sign() * 0.08 * w)
            * pose.local[arm.upper];
        let elbow = g.elbow + 0.25 * g.elbow * (-g.arm_pitch[i]).max(0.0);
        pose.local[arm.fore] = Quat::from_rotation_x(-elbow * w) * pose.local[arm.fore];
        crate::hands::curl_fingers(h, pose, side, g.fist * w);
    }
    let world = sk.world(pose);
    let root_rot = pose.root_rot;
    let root_pos = pose.root_pos;
    for side in Side::BOTH {
        let i = side as usize;
        let leg = h.leg(side);
        let rest_target = Vec3::new(
            side.sign() * h.proportions.hip_width * 0.5,
            leg.ankle_height,
            0.0,
        );
        let local_target = rest_target.lerp(g.ankle_target[i], w);
        let target = root_pos + root_rot * local_target;
        let knee = world[leg.shin].pos;
        let pole = knee + root_rot * Vec3::new(0.0, 0.0, 1.0);
        ik::two_bone(sk, pose, leg.thigh, leg.shin, leg.foot, target, pole);
        // Jalkaterä maan suuntaiseksi + kanta/varvas-kallistus.
        sk.set_world_rotation(
            pose,
            leg.foot,
            root_rot * Quat::from_rotation_x(-g.foot_pitch[i] * w),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::humanoid::Proportions;

    /// Vastine TS-testille "stance foot slip < 1 px": tukijalka ei liu'u maailmassa.
    #[test]
    fn planted_foot_does_not_slip() {
        let h = Humanoid::new(Proportions::default());
        for params in [GaitParams::walk(), GaitParams::run()] {
            let speed = params.speed(h.pelvis_height());
            let dt = 1.0 / 240.0;
            let mut last: Option<(bool, Vec3)> = None;
            let mut max_slip: f32 = 0.0;
            for k in 0..480 {
                let t = k as f32 * dt;
                let g = sample(&h, &params, t * params.frequency);
                let world = Vec3::new(0.0, 0.0, speed * t) + g.ankle_target[0];
                if let (Some((true, prev)), true) = (last, g.planted[0]) {
                    // Vaakasuora liukuma; pystysuunnassa nilkka saa nousta kanta-varvasrullauksessa.
                    max_slip =
                        max_slip.max(Vec3::new(world.x - prev.x, 0.0, world.z - prev.z).length());
                }
                last = Some((g.planted[0], world));
            }
            assert!(max_slip < 1e-4, "liukuma {max_slip} m/askel");
        }
    }

    #[test]
    fn run_has_flight_phase_and_walk_double_support() {
        let h = Humanoid::new(Proportions::default());
        let flight = (0..100).any(|k| {
            let g = sample(&h, &GaitParams::run(), k as f32 / 100.0);
            !g.planted[0] && !g.planted[1]
        });
        assert!(flight);
        let double = (0..100).any(|k| {
            let g = sample(&h, &GaitParams::walk(), k as f32 / 100.0);
            g.planted[0] && g.planted[1]
        });
        assert!(double);
    }

    #[test]
    fn ik_lands_ankles_on_targets_and_shoulders_counter_rotate() {
        let h = Humanoid::new(Proportions::default());
        for k in 0..20 {
            let mut pose = h.rest_pose();
            let g = sample(&h, &GaitParams::run(), k as f32 / 20.0);
            apply(&h, &mut pose, &g, 1.0);
            let w = h.skeleton.world(&pose);
            for side in Side::BOTH {
                let err = (w[h.leg(side).foot].pos - g.ankle_target[side as usize]).length();
                assert!(err < 2e-3, "nilkan virhe {err} vaiheessa {k}");
            }
            assert!(g.chest_yaw * g.pelvis_yaw <= 0.0);
        }
    }
}
