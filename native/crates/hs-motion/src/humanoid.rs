//! Parametrinen ihmisluuranko. Koordinaatisto: Y ylös, hahmo katsoo +Z:aan,
//! hahmon vasen puoli on +X. Yksikkö on metri.

use crate::skeleton::{Pose, Skeleton};
use glam::Vec3;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Side {
    Left,
    Right,
}

impl Side {
    pub const BOTH: [Side; 2] = [Side::Left, Side::Right];
    /// +1 vasemmalle (+X), -1 oikealle.
    pub fn sign(self) -> f32 {
        match self {
            Side::Left => 1.0,
            Side::Right => -1.0,
        }
    }
    pub fn prefix(self) -> &'static str {
        match self {
            Side::Left => "l",
            Side::Right => "r",
        }
    }
}

/// Mittasuhteet. Arvot ovat suhteellisia pituuteen, jotta sama luuranko
/// skaalautuu lapsesta aikuiseen.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Proportions {
    /// Kokonaispituus metreinä.
    pub height: f32,
    /// Jalan pituus lonkasta maahan suhteessa pituuteen.
    pub leg_ratio: f32,
    /// Käden pituus olkapäästä sormenpäihin suhteessa pituuteen.
    pub arm_ratio: f32,
    pub shoulder_width: f32,
    pub hip_width: f32,
    /// Pään korkeus suhteessa pituuteen (lapsilla suurempi).
    pub head_ratio: f32,
    pub hand_scale: f32,
    /// Hiusten (poninhäntä) pituus metreinä; 0 = ei hiusketjua.
    pub hair_length: f32,
}

impl Default for Proportions {
    fn default() -> Self {
        // Lapsihahmo (Pipsa/Ville/Taru-mittakaava).
        Proportions {
            height: 1.25,
            leg_ratio: 0.45,
            arm_ratio: 0.40,
            shoulder_width: 0.25,
            hip_width: 0.17,
            head_ratio: 0.17,
            hand_scale: 1.0,
            hair_length: 0.16,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Finger {
    /// Kolme falanksia tyvestä kärkeen.
    pub joints: [usize; 3],
    /// Kärjen paikka viimeisen nivelen koordinaatistossa.
    pub tip: Vec3,
    /// Taivutusakseli lepokoordinaatistossa (positiivinen kulma koukistaa kämmentä kohti).
    pub curl_axis: Vec3,
    pub lengths: [f32; 3],
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Arm {
    pub clavicle: usize,
    pub upper: usize,
    pub fore: usize,
    pub hand: usize,
    /// Peukalo, etu-, keski-, nimetön ja pikkusormi.
    pub fingers: [Finger; 5],
    pub upper_len: f32,
    pub fore_len: f32,
    pub hand_len: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Leg {
    pub thigh: usize,
    pub shin: usize,
    pub foot: usize,
    pub toe: usize,
    pub thigh_len: f32,
    pub shin_len: f32,
    /// Nilkan korkeus maasta lepoasennossa.
    pub ankle_height: f32,
    pub foot_len: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Humanoid {
    pub proportions: Proportions,
    pub skeleton: Skeleton,
    pub pelvis: usize,
    pub spine: usize,
    pub chest: usize,
    pub neck: usize,
    pub head: usize,
    pub head_height: f32,
    /// Leuka: suun alahuuli seuraa tätä (suun avautuminen siirtää sitä alas).
    pub jaw: usize,
    pub hair: Vec<usize>,
    pub hem_front: usize,
    pub hem_back: usize,
    pub arms: [Arm; 2],
    pub legs: [Leg; 2],
}

pub const FINGER_NAMES: [&str; 5] = ["thumb", "index", "middle", "ring", "pinky"];

impl Humanoid {
    pub fn new(p: Proportions) -> Humanoid {
        let h = p.height.clamp(0.5, 2.5);
        let mut s = Skeleton::default();
        let leg = h * p.leg_ratio.clamp(0.3, 0.6);
        let head_h = h * p.head_ratio.clamp(0.1, 0.25);
        let neck_len = h * 0.035;
        let torso = (h - leg - neck_len - head_h).max(h * 0.15);

        let pelvis = s.add("pelvis", None, Vec3::new(0.0, leg, 0.0));
        let spine = s.add("spine", Some(pelvis), Vec3::new(0.0, torso * 0.30, 0.0));
        let chest = s.add("chest", Some(spine), Vec3::new(0.0, torso * 0.35, 0.0));
        let neck = s.add("neck", Some(chest), Vec3::new(0.0, torso * 0.35, 0.0));
        let head = s.add("head", Some(neck), Vec3::new(0.0, neck_len, 0.0));

        let jaw = s.add("jaw", Some(head), Vec3::new(0.0, head_h * 0.26, head_h * 0.36));
        let mut hair = Vec::new();
        if p.hair_length > 0.01 {
            let h0 = s.add("hair0", Some(head), Vec3::new(0.0, head_h * 0.72, -head_h * 0.42));
            let h1 = s.add("hair1", Some(h0), Vec3::new(0.0, -p.hair_length * 0.5, -0.015));
            hair.extend([h0, h1]);
        }
        let hip_depth = h * 0.06;
        let hem_front = s.add("hem_front", Some(pelvis), Vec3::new(0.0, -h * 0.02, hip_depth));
        let hem_back = s.add("hem_back", Some(pelvis), Vec3::new(0.0, -h * 0.02, -hip_depth));

        let arm_len = h * p.arm_ratio.clamp(0.25, 0.5);
        let upper_len = arm_len * 0.40;
        let fore_len = arm_len * 0.36;
        let hand_len = arm_len * 0.24 * p.hand_scale.clamp(0.6, 1.6);
        let make_arm = |s: &mut Skeleton, side: Side| -> Arm {
            let x = side.sign();
            let pre = side.prefix();
            let clavicle = s.add(&format!("{pre}_clavicle"), Some(chest), Vec3::new(x * h * 0.015, torso * 0.24, 0.0));
            let upper = s.add(
                &format!("{pre}_upper_arm"),
                Some(clavicle),
                Vec3::new(x * (p.shoulder_width * 0.5 - h * 0.015).max(0.02), 0.0, 0.0),
            );
            let fore = s.add(&format!("{pre}_forearm"), Some(upper), Vec3::new(0.0, -upper_len, 0.0));
            let hand = s.add(&format!("{pre}_hand"), Some(fore), Vec3::new(0.0, -fore_len, 0.0));
            let palm = hand_len * 0.48;
            let finger_len = hand_len - palm;
            let palm_w = hand_len * 0.42;
            // Kämmen osoittaa kehoa kohti (-x * sign); sormet levittyvät eteen-taakse (Z).
            let curl_axis = Vec3::Z * -x;
            let mut fingers: Vec<Finger> = Vec::new();
            for (k, name) in FINGER_NAMES.iter().enumerate() {
                if k == 0 {
                    let dir = Vec3::new(-x * 0.35, -0.55, 0.76).normalize();
                    let l = [finger_len * 0.42, finger_len * 0.34, finger_len * 0.30];
                    let base = Vec3::new(-x * hand_len * 0.06, -palm * 0.30, palm_w * 0.45);
                    let j1 = s.add(&format!("{pre}_{name}1"), Some(hand), base);
                    let j2 = s.add(&format!("{pre}_{name}2"), Some(j1), dir * l[0]);
                    let j3 = s.add(&format!("{pre}_{name}3"), Some(j2), dir * l[1]);
                    // Peukalo koukistuu kämmenen yli.
                    let axis = dir.cross(Vec3::X * -x).normalize();
                    fingers.push(Finger { joints: [j1, j2, j3], tip: dir * l[2], curl_axis: axis, lengths: l });
                } else {
                    let z = [0.0, 0.38, 0.12, -0.13, -0.36][k] * palm_w;
                    let scale = [0.0, 0.95, 1.0, 0.93, 0.75][k];
                    let l = [finger_len * 0.45 * scale, finger_len * 0.30 * scale, finger_len * 0.25 * scale];
                    let base = Vec3::new(0.0, -palm * (0.92 + if k == 2 { 0.08 } else { 0.0 }), z);
                    let j1 = s.add(&format!("{pre}_{name}1"), Some(hand), base);
                    let j2 = s.add(&format!("{pre}_{name}2"), Some(j1), Vec3::new(0.0, -l[0], 0.0));
                    let j3 = s.add(&format!("{pre}_{name}3"), Some(j2), Vec3::new(0.0, -l[1], 0.0));
                    fingers.push(Finger {
                        joints: [j1, j2, j3],
                        tip: Vec3::new(0.0, -l[2], 0.0),
                        curl_axis,
                        lengths: l,
                    });
                }
            }
            let fingers: [Finger; 5] = fingers.try_into().expect("viisi sormea");
            Arm { clavicle, upper, fore, hand, fingers, upper_len, fore_len, hand_len }
        };
        let left_arm = make_arm(&mut s, Side::Left);
        let right_arm = make_arm(&mut s, Side::Right);

        let ankle_height = h * 0.045;
        let foot_len = h * 0.13;
        let hip_drop = h * 0.03;
        let limb = leg - hip_drop - ankle_height;
        let thigh_len = limb * 0.5;
        let shin_len = limb - thigh_len;
        let make_leg = |s: &mut Skeleton, side: Side| -> Leg {
            let x = side.sign();
            let pre = side.prefix();
            let thigh = s.add(&format!("{pre}_thigh"), Some(pelvis), Vec3::new(x * p.hip_width * 0.5, -hip_drop, 0.0));
            let shin = s.add(&format!("{pre}_shin"), Some(thigh), Vec3::new(0.0, -thigh_len, 0.0));
            let foot = s.add(&format!("{pre}_foot"), Some(shin), Vec3::new(0.0, -shin_len, 0.0));
            let toe = s.add(&format!("{pre}_toe"), Some(foot), Vec3::new(0.0, -ankle_height * 0.8, foot_len * 0.62));
            Leg { thigh, shin, foot, toe, thigh_len, shin_len, ankle_height, foot_len }
        };
        let left_leg = make_leg(&mut s, Side::Left);
        let right_leg = make_leg(&mut s, Side::Right);

        Humanoid {
            proportions: p,
            skeleton: s,
            pelvis,
            spine,
            chest,
            neck,
            head,
            head_height: head_h,
            jaw,
            hair,
            hem_front,
            hem_back,
            arms: [left_arm, right_arm],
            legs: [left_leg, right_leg],
        }
    }

    pub fn arm(&self, side: Side) -> &Arm {
        &self.arms[side as usize]
    }
    pub fn leg(&self, side: Side) -> &Leg {
        &self.legs[side as usize]
    }
    pub fn rest_pose(&self) -> Pose {
        Pose::rest(&self.skeleton)
    }
    /// Nilkkojen etäisyys lantiosta lepoasennossa (pystysuunnassa).
    pub fn pelvis_height(&self) -> f32 {
        self.skeleton.joints[self.pelvis].offset.y
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn humanoid_has_five_fingers_per_hand_and_fits_bone_budget() {
        let h = Humanoid::new(Proportions::default());
        for side in Side::BOTH {
            let arm = h.arm(side);
            assert_eq!(arm.fingers.len(), 5);
            for f in &arm.fingers {
                assert!(f.lengths.iter().all(|l| *l > 0.003));
            }
        }
        assert!(h.skeleton.len() <= 64, "{} niveltä", h.skeleton.len());
        let bind = h.skeleton.bind_positions();
        // Jalkaterät maassa, pää ylimpänä, vasen käsi +X:ssä.
        let ankle = bind[h.leg(Side::Left).foot];
        assert!((ankle.y - h.leg(Side::Left).ankle_height).abs() < 1e-4);
        assert!(bind[h.arm(Side::Left).hand].x > 0.0 && bind[h.arm(Side::Right).hand].x < 0.0);
        let top = bind[h.head].y + h.head_height;
        assert!((top - h.proportions.height).abs() < 1e-3, "pää {top}");
    }
}
