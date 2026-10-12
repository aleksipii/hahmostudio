//! Kädet: sormien koukistus, otteet ja puhelimen näpyttely.
//!
//! Näpyttelyssä puhelin on molemmissa käsissä rinnan edessä. Kädet ratkaistaan
//! kahden luun IK:lla otekohtiin, sormet tukevat puhelimen takapintaa (CCD) ja
//! peukalot näpyttelevät ruudun näppäimiä vuorotellen. Peukalon rata on
//! siniaalto: se nousee näppäinten välillä ja painaa näppäintä vaiheessa
//! [`PRESS_PHASE`]. Muut sormet säätävät otetta viivästetyillä siniaalloilla.

use crate::humanoid::{Humanoid, Side};
use crate::ik::{self, JointLimit};
use crate::skeleton::{JointWorld, Pose};
use glam::{Mat3, Quat, Vec3};
use serde::{Deserialize, Serialize};
use std::f32::consts::TAU;

/// Peukalon syklin vaihe, jossa kärki koskettaa ruutua.
pub const PRESS_PHASE: f32 = 0.8;

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct PhoneSpec {
    pub width: f32,
    pub height: f32,
    pub depth: f32,
}

impl Default for PhoneSpec {
    fn default() -> Self {
        PhoneSpec { width: 0.068, height: 0.140, depth: 0.008 }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct TapParams {
    /// Yksittäisen näppäilyn kesto (s); peukalot vuorottelevat.
    pub tap_period: f32,
    /// Peukalon nousu ruudun yläpuolelle näppäinten välillä (m).
    pub lift: f32,
    /// Sormien otteen säätöaallon voimakkuus (rad).
    pub grip_wave: f32,
    /// Viive sormien välillä (s).
    pub finger_delay: f32,
}

impl Default for TapParams {
    fn default() -> Self {
        TapParams { tap_period: 0.24, lift: 0.012, grip_wave: 0.07, finger_delay: 0.06 }
    }
}

/// Puhelimen tila yhdessä ruudussa (renderöintiä varten).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PhoneState {
    pub transform: JointWorld,
    pub spec: PhoneSpec,
    /// Painettu näppäin (sarake, rivi) tai `None`.
    pub pressed: Option<(u8, u8)>,
    /// Peukaloiden kärkien virhe kohteesta (m), testausta varten.
    pub thumb_error: [f32; 2],
    /// Peukaloiden kohteet ruudulla (maailmassa).
    pub thumb_target: [Vec3; 2],
    /// Koskettaako peukalo ruutua.
    pub touching: [bool; 2],
}

/// Koukistaa kaikkia sormia (0 = suora, 1 = nyrkki).
pub fn curl_fingers(h: &Humanoid, pose: &mut Pose, side: Side, amount: f32) {
    let arm = h.arm(side);
    for (k, f) in arm.fingers.iter().enumerate() {
        let scale = if k == 0 { [0.35, 0.5, 0.5] } else { [1.25, 1.55, 1.05] };
        for (j, joint) in f.joints.iter().enumerate() {
            pose.local[*joint] = Quat::from_axis_angle(f.curl_axis, amount * scale[j]);
        }
    }
}

fn finger_limits(h: &Humanoid, side: Side, finger: usize) -> [JointLimit; 3] {
    let f = &h.arm(side).fingers[finger];
    if finger == 0 {
        [
            JointLimit::Cone { max_angle: 1.1 },
            JointLimit::Hinge { axis: f.curl_axis, min: -0.5, max: 1.2 },
            JointLimit::Hinge { axis: f.curl_axis, min: -0.6, max: 1.4 },
        ]
    } else {
        [
            JointLimit::Hinge { axis: f.curl_axis, min: -0.2, max: 1.6 },
            JointLimit::Hinge { axis: f.curl_axis, min: 0.0, max: 1.9 },
            JointLimit::Hinge { axis: f.curl_axis, min: 0.0, max: 1.4 },
        ]
    }
}

/// Ohjaa yhden sormen kärjen IK:lla kohteeseen. Palauttaa jäännösvirheen.
pub fn reach_finger(h: &Humanoid, pose: &mut Pose, side: Side, finger: usize, target: Vec3) -> f32 {
    let f = &h.arm(side).fingers[finger];
    let limits = finger_limits(h, side, finger);
    // Deterministinen alkuarvaus (kevyt koukistus) ja kaksi lähtöä, joista paras valitaan:
    // CCD voi jäädä paikalliseen minimiin, kun sarana estää suoran reitin.
    let mut best: Option<(f32, [Quat; 3])> = None;
    for start in [0.25f32, 0.9] {
        for (j, joint) in f.joints.iter().enumerate() {
            pose.local[*joint] = Quat::from_axis_angle(f.curl_axis, start * [0.5, 1.0, 1.0][j]);
        }
        let err = ik::ccd_chain(&h.skeleton, pose, &f.joints, &limits, f.tip, target, 40);
        if best.is_none_or(|(e, _)| err < e) {
            best = Some((err, f.joints.map(|j| pose.local[j])));
        }
    }
    let (err, rots) = best.expect("vähintään yksi lähtö");
    for (joint, rot) in f.joints.iter().zip(rots) {
        pose.local[*joint] = rot;
    }
    err
}

fn hash(n: i64) -> u64 {
    let mut x = n as u64 ^ 0x9e37_79b9_7f4a_7c15;
    x = (x ^ (x >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
    x = (x ^ (x >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
    x ^ (x >> 31)
}

/// Näppäimistö: 3 saraketta × 4 riviä ruudun alaosassa. Vasen peukalo
/// (hahmon vasen) painaa sarakkeita 0–1, oikea sarakkeita 1–2.
fn key_for(tap: i64, side: Side) -> (u8, u8) {
    let r = hash(tap);
    let col = match side {
        Side::Left => (r % 2) as u8,
        Side::Right => 1 + (r % 2) as u8,
    };
    let row = ((r >> 8) % 4) as u8;
    (col, row)
}

/// Näppäimen keskipiste puhelimen paikallisessa koordinaatistossa.
/// Puhelimen +X = hahmon oikea, +Y = ylös, +Z = ruudun normaali (kasvoja kohti).
fn key_local(spec: &PhoneSpec, key: (u8, u8)) -> Vec3 {
    let (col, row) = key;
    // Hahmon vasen on puhelimen -X.
    let x = (col as f32 - 1.0) * spec.width * 0.24;
    let y = spec.height * (0.03 - row as f32 * 0.07);
    Vec3::new(x, y, spec.depth * 0.5)
}

fn smoothstep(x: f32) -> f32 {
    let x = x.clamp(0.0, 1.0);
    x * x * (3.0 - 2.0 * x)
}

/// Muodostaa kierron, joka vie paikalliset (sormisuunta, kämmenen normaali) maailman vastaaviin.
fn basis_rotation(local_f: Vec3, local_n: Vec3, world_f: Vec3, world_n: Vec3) -> Quat {
    let lf = local_f.normalize();
    let ln = (local_n - lf * local_n.dot(lf)).normalize();
    let wf = world_f.normalize();
    let wn = (world_n - wf * world_n.dot(wf)).normalize();
    let l = Mat3::from_cols(lf, ln, lf.cross(ln));
    let w = Mat3::from_cols(wf, wn, wf.cross(wn));
    Quat::from_mat3(&(w * l.transpose())).normalize()
}

/// Puhelimen paikka rinnan edessä niin, että ruutu katsoo silmiin.
pub fn phone_transform(h: &Humanoid, world: &[JointWorld], root_rot: Quat, spec: &PhoneSpec) -> JointWorld {
    let chest = world[h.chest].pos;
    let head = world[h.head].pos + root_rot * Vec3::new(0.0, h.head_height * 0.45, h.head_height * 0.3);
    let arm = h.arm(Side::Left);
    let reach = arm.upper_len + arm.fore_len;
    let center = chest + root_rot * Vec3::new(0.0, -reach * 0.22, reach * 0.62);
    let normal = (head - center).normalize();
    let up_hint = root_rot * Vec3::Y;
    let y = (up_hint - normal * up_hint.dot(normal)).normalize();
    let x = y.cross(normal);
    let _ = spec;
    JointWorld { rot: Quat::from_mat3(&Mat3::from_cols(x, y, normal)).normalize(), pos: center }
}

/// Kaksikätinen ote puhelimesta ja peukalonäpyttely hetkellä `t` (s).
/// `weight` sekoittaa otteen sisään/ulos (0..1).
pub fn phone_tapping(h: &Humanoid, pose: &mut Pose, t: f32, params: &TapParams, spec: &PhoneSpec, weight: f32) -> PhoneState {
    let sk = &h.skeleton;
    let world = sk.world(pose);
    let phone = phone_transform(h, &world, pose.root_rot, spec);
    let (px, py, pz) = (phone.rot * Vec3::X, phone.rot * Vec3::Y, phone.rot * Vec3::Z);
    let mut state = PhoneState {
        transform: phone,
        spec: *spec,
        pressed: None,
        thumb_error: [0.0; 2],
        thumb_target: [Vec3::ZERO; 2],
        touching: [false; 2],
    };
    let w = weight.clamp(0.0, 1.0);
    for side in Side::BOTH {
        let i = side as usize;
        let s = side.sign();
        let arm = h.arm(side);
        // Hahmon vasen käsi on puhelimen -X-reunalla.
        let edge = -s;
        // Sormet osoittavat takapinnan poikki toista reunaa kohti, hieman ylöspäin.
        let finger_dir = (px * -edge + py * 0.35).normalize();
        // Kämmen kohti puhelimen takapintaa eli normaalin suuntaan.
        let palm_normal = pz;
        let local_f = Vec3::NEG_Y;
        let local_n = Vec3::X * -s;
        let hand_rot = basis_rotation(local_f, local_n, finger_dir, palm_normal);
        let palm_center = phone.pos + px * (edge * spec.width * 0.52) + py * (-spec.height * 0.36) - pz * (spec.depth * 0.5 + 0.014);
        let palm_offset = hand_rot * Vec3::new(0.0, -arm.hand_len * 0.24, 0.0);
        let wrist = palm_center - palm_offset;

        // Kyynärpäät alas ja sivuille.
        let shoulder = world[arm.upper].pos;
        let pole = shoulder + pose.root_rot * Vec3::new(s * 0.35, -0.5, -0.15);
        let rest_wrist = world[arm.hand].pos;
        let target = rest_wrist.lerp(wrist, w);
        ik::two_bone(sk, pose, arm.upper, arm.fore, arm.hand, target, pole);
        let current = sk.world(pose)[arm.hand].rot;
        sk.set_world_rotation(pose, arm.hand, current.slerp(hand_rot, w));

        // Sormet tukevat takapintaa; ote "elää" viivästetyillä siniaalloilla.
        for k in 1..5 {
            let delay = k as f32 * params.finger_delay + i as f32 * 0.11;
            let wave = params.grip_wave * (TAU * (t - delay) / (params.tap_period * 4.0)).sin();
            let base_curl = 0.55 + wave;
            let f = &arm.fingers[k];
            for (j, joint) in f.joints.iter().enumerate() {
                pose.local[*joint] = Quat::from_axis_angle(f.curl_axis, base_curl * w * [1.0, 1.2, 0.9][j]);
            }
        }

        // Peukalon näpyttely: vuoro i saa näppäimet tapeista n ≡ i (mod 2).
        let period = params.tap_period * 2.0;
        let local_t = t - i as f32 * params.tap_period;
        let cycle = (local_t / period).floor();
        let u = local_t / period - cycle;
        let tap_index = cycle as i64 * 2 + i as i64;
        let prev_key = key_for(tap_index - 2, side);
        let next_key = key_for(tap_index, side);
        let from = key_local(spec, prev_key);
        let to = key_local(spec, next_key);
        let travel = smoothstep(u / 0.6);
        let lift = params.lift * (0.5 - 0.5 * (TAU * (u - PRESS_PHASE)).cos());
        let local_target = from.lerp(to, travel) + Vec3::Z * lift;
        let target = phone.transform_point(local_target);
        state.thumb_target[i] = target;
        if w > 0.999 {
            let err = reach_finger(h, pose, side, 0, target);
            state.thumb_error[i] = err;
            state.touching[i] = (u - PRESS_PHASE).abs() < 0.06;
            if state.touching[i] {
                state.pressed = Some(next_key);
            }
        } else {
            curl_fingers_partial(h, pose, side, 0, 0.3 * w);
        }
    }
    state
}

fn curl_fingers_partial(h: &Humanoid, pose: &mut Pose, side: Side, finger: usize, amount: f32) {
    let f = &h.arm(side).fingers[finger];
    for joint in f.joints {
        pose.local[joint] = Quat::from_axis_angle(f.curl_axis, amount);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::humanoid::Proportions;

    #[test]
    fn fingers_curl_toward_the_palm() {
        let h = Humanoid::new(Proportions::default());
        for side in Side::BOTH {
            let mut pose = h.rest_pose();
            let before = h.skeleton.world(&pose);
            let tip_before = before[h.arm(side).fingers[2].joints[2]].transform_point(h.arm(side).fingers[2].tip);
            curl_fingers(&h, &mut pose, side, 1.0);
            let after = h.skeleton.world(&pose);
            let tip_after = after[h.arm(side).fingers[2].joints[2]].transform_point(h.arm(side).fingers[2].tip);
            // Kämmen osoittaa kehoa kohti: koukistunut kärki siirtyy kohti keskiviivaa (x -> 0).
            assert!(tip_after.x.abs() < tip_before.x.abs(), "{side:?}");
            assert!(tip_after.y > tip_before.y);
        }
    }

    #[test]
    fn thumbs_hit_screen_keys_when_pressing() {
        let h = Humanoid::new(Proportions::default());
        let params = TapParams::default();
        let spec = PhoneSpec::default();
        let mut presses = 0;
        let mut worst: f32 = 0.0;
        for k in 0..240 {
            let t = k as f32 / 60.0;
            let mut pose = h.rest_pose();
            let state = phone_tapping(&h, &mut pose, t, &params, &spec, 1.0);
            for i in 0..2 {
                worst = worst.max(state.thumb_error[i]);
                if state.touching[i] {
                    presses += 1;
                    // Kosketuksessa kärki on ruudun pinnalla (alle 3 mm).
                    assert!(state.thumb_error[i] < 3e-3, "peukalo {i} virhe {} hetkellä {t}", state.thumb_error[i]);
                }
            }
        }
        assert!(presses > 10, "painalluksia {presses}");
        assert!(worst < 6e-3, "suurin virhe {worst}");
    }

    #[test]
    fn tapping_is_deterministic_for_scrubbing() {
        let h = Humanoid::new(Proportions::default());
        let run = |t: f32| {
            let mut pose = h.rest_pose();
            phone_tapping(&h, &mut pose, t, &TapParams::default(), &PhoneSpec::default(), 1.0);
            pose
        };
        assert_eq!(run(1.37), run(1.37));
    }
}
