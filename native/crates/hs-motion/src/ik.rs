//! Käänteiskinematiikka.
//!
//! * [`two_bone`]: analyyttinen ratkaisu raajoille (olka-kyynär-ranne, lonkka-polvi-nilkka).
//!   Polven/kyynärpään taivutustaso valitaan napavektorilla.
//! * [`ccd_chain`]: iteratiivinen CCD sormille, jossa saranat ja kartiot rajoittavat nivelet
//!   anatomisesti järkeviin kulmiin.

use crate::skeleton::{Pose, Skeleton};
use glam::{Quat, Vec3};

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TwoBoneResult {
    /// Kohde oli ulottumattomissa ja raaja ojennettiin sen suuntaan.
    pub clamped: bool,
    /// Loppunivelen etäisyys kohteesta ratkaisun jälkeen.
    pub error: f32,
}

fn arc(from: Vec3, to: Vec3) -> Quat {
    let (a, b) = (from.normalize_or_zero(), to.normalize_or_zero());
    if a == Vec3::ZERO || b == Vec3::ZERO {
        return Quat::IDENTITY;
    }
    Quat::from_rotation_arc(a, b)
}

/// Ratkaisee kahden luun ketjun `upper -> lower -> end` niin, että `end` osuu
/// kohteeseen `target` ja keskinivel taipuu kohti pistettä `pole`.
pub fn two_bone(
    skel: &Skeleton,
    pose: &mut Pose,
    upper: usize,
    lower: usize,
    end: usize,
    target: Vec3,
    pole: Vec3,
) -> TwoBoneResult {
    let w = skel.world(pose);
    let (a, b, c) = (w[upper].pos, w[lower].pos, w[end].pos);
    let l1 = (b - a).length();
    let l2 = (c - b).length();
    let to_target = target - a;
    let raw = to_target.length();
    let min = (l1 - l2).abs() + 1e-4;
    let max = l1 + l2 - 1e-4;
    let dist = raw.clamp(min, max);
    let clamped = raw > max + 1e-5 || raw < min - 1e-5;
    let dir = if raw > 1e-6 { to_target / raw } else { (c - a).normalize_or_zero() };

    // Taivutustason suunta: napavektorin kohtisuora osa kohdesuunnasta.
    let mut bend = (pole - a) - dir * (pole - a).dot(dir);
    if bend.length_squared() < 1e-10 {
        bend = (b - a) - dir * (b - a).dot(dir);
    }
    if bend.length_squared() < 1e-10 {
        bend = dir.any_orthonormal_vector();
    }
    let bend = bend.normalize();
    let cos_a = ((l1 * l1 + dist * dist - l2 * l2) / (2.0 * l1 * dist)).clamp(-1.0, 1.0);
    let sin_a = (1.0 - cos_a * cos_a).max(0.0).sqrt();
    let b_new = a + (dir * cos_a + bend * sin_a) * l1;
    let c_new = a + dir * dist;

    // Yläluu: käännä nykyinen suunta uuteen (swing; kierto luun ympäri säilyy).
    let upper_world = arc(b - a, b_new - a) * w[upper].rot;
    skel.set_world_rotation(pose, upper, upper_world);
    let w2 = skel.world(pose);
    let lower_world = arc(w2[end].pos - w2[lower].pos, c_new - w2[lower].pos) * w2[lower].rot;
    skel.set_world_rotation(pose, lower, lower_world);
    let error = (skel.world(pose)[end].pos - target).length();
    TwoBoneResult { clamped, error }
}

/// Nivelen liikerajoitus CCD:lle.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum JointLimit {
    /// Kierto vain annetun (vanhemman koordinaatiston) akselin ympäri kulmavälillä.
    Hinge { axis: Vec3, min: f32, max: f32 },
    /// Vapaa kierto, mutta korkeintaan `max_angle` lepoasennosta.
    Cone { max_angle: f32 },
}

impl JointLimit {
    fn apply(self, q: Quat) -> Quat {
        match self {
            JointLimit::Hinge { axis, min, max } => {
                // Kierron "twist"-osa akselin ympäri.
                let axis = axis.normalize();
                let v = Vec3::new(q.x, q.y, q.z);
                let p = axis * v.dot(axis);
                let twist = Quat::from_xyzw(p.x, p.y, p.z, q.w);
                let twist = if twist.length_squared() < 1e-12 { Quat::IDENTITY } else { twist.normalize() };
                let (ax, mut angle) = twist.to_axis_angle();
                if ax.dot(axis) < 0.0 {
                    angle = -angle;
                }
                if angle > std::f32::consts::PI {
                    angle -= std::f32::consts::TAU;
                }
                Quat::from_axis_angle(axis, angle.clamp(min, max))
            }
            JointLimit::Cone { max_angle } => {
                let (axis, angle) = q.to_axis_angle();
                let angle = if angle > std::f32::consts::PI { angle - std::f32::consts::TAU } else { angle };
                if angle.abs() <= max_angle {
                    q
                } else {
                    Quat::from_axis_angle(axis, max_angle * angle.signum())
                }
            }
        }
    }
}

/// CCD (cyclic coordinate descent) rajoitetulle ketjulle. `chain` on tyvestä
/// kärkeen, `tip` on kärjen paikka viimeisen nivelen koordinaatistossa.
/// Palauttaa kärjen jäännösvirheen metreinä.
pub fn ccd_chain(
    skel: &Skeleton,
    pose: &mut Pose,
    chain: &[usize],
    limits: &[JointLimit],
    tip: Vec3,
    target: Vec3,
    iterations: usize,
) -> f32 {
    debug_assert_eq!(chain.len(), limits.len());
    let tip_world = |pose: &Pose| {
        let w = skel.world(pose);
        w[*chain.last().unwrap()].transform_point(tip)
    };
    let mut error = (tip_world(pose) - target).length();
    for _ in 0..iterations {
        if error < 2e-4 {
            break;
        }
        for (k, &j) in chain.iter().enumerate().rev() {
            let w = skel.world(pose);
            let joint = w[j].pos;
            let end = w[*chain.last().unwrap()].transform_point(tip);
            let delta = arc(end - joint, target - joint);
            let parent_rot = match skel.joints[j].parent {
                Some(p) => w[p].rot,
                None => pose.root_rot,
            };
            let world_new = delta * w[j].rot;
            let local = (parent_rot.inverse() * world_new).normalize();
            pose.local[j] = limits[k].apply(local);
        }
        error = (tip_world(pose) - target).length();
    }
    error
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::humanoid::{Humanoid, Proportions, Side};

    #[test]
    fn two_bone_reaches_and_respects_pole() {
        let h = Humanoid::new(Proportions::default());
        let mut pose = h.rest_pose();
        let arm = h.arm(Side::Left);
        let w = h.skeleton.world(&pose);
        let shoulder = w[arm.upper].pos;
        let target = shoulder + Vec3::new(0.05, -0.15, 0.25);
        let pole = shoulder + Vec3::new(0.3, -0.2, -0.4);
        let r = two_bone(&h.skeleton, &mut pose, arm.upper, arm.fore, arm.hand, target, pole);
        assert!(!r.clamped);
        assert!(r.error < 1e-4, "virhe {}", r.error);
        let w = h.skeleton.world(&pose);
        // Kyynärpää on napavektorin puolella.
        let elbow = w[arm.fore].pos - shoulder;
        let dir = (target - shoulder).normalize();
        let side = elbow - dir * elbow.dot(dir);
        assert!(side.dot(pole - shoulder) > 0.0);
        // Luiden pituudet säilyvät.
        assert!(((w[arm.fore].pos - w[arm.upper].pos).length() - arm.upper_len).abs() < 1e-4);
    }

    #[test]
    fn two_bone_clamps_unreachable_targets() {
        let h = Humanoid::new(Proportions::default());
        let mut pose = h.rest_pose();
        let leg = h.leg(Side::Right);
        let r = two_bone(&h.skeleton, &mut pose, leg.thigh, leg.shin, leg.foot, Vec3::new(0.0, -5.0, 0.0), Vec3::Z);
        assert!(r.clamped);
    }

    #[test]
    fn hinge_limit_keeps_finger_in_plane() {
        let limit = JointLimit::Hinge { axis: Vec3::Z, min: 0.0, max: 1.5 };
        let q = Quat::from_rotation_x(0.7) * Quat::from_rotation_z(0.5);
        let c = limit.apply(q);
        let (axis, angle) = c.to_axis_angle();
        assert!(axis.abs().dot(Vec3::Z) > 0.999 || angle.abs() < 1e-5);
        assert!(limit.apply(Quat::from_rotation_z(-0.4)).angle_between(Quat::IDENTITY) < 1e-5);
    }
}
