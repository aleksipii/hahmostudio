//! Kasvot: suun muoto visemeistä.
//!
//! Suu on rigattu viidellä luulla (ylähuuli, suupielet, hampaat, kieli) ja
//! leualla (alahuuli). [`apply_mouth`] kääntää [`MouthShape`]-parametrit
//! luiden siirroiksi pään koordinaatistossa, joten sama muoto toimii kaikilla
//! hahmoilla pään koon mukaan skaalattuna.

use crate::humanoid::Humanoid;
use crate::skeleton::Pose;
use glam::Vec3;
pub use hs_lipsync::MouthShape;

pub fn apply_mouth(h: &Humanoid, pose: &mut Pose, m: &MouthShape) {
    let hh = h.head_height;
    let r = &h.mouth;
    // Imported/authored shapes are bounded at the rig boundary; nonfinite
    // channels become neutral rather than poisoning every FK transform.
    let unit = |value: f32| {
        if value.is_finite() {
            value.clamp(0.0, 1.0)
        } else {
            0.0
        }
    };
    let closed = unit(m.closed);
    let open = unit(m.open) * (1.0 - closed);
    let round = unit(m.round);
    let wide = if m.wide.is_finite() {
        m.wide.clamp(-1.0, 1.0)
    } else {
        0.0
    };
    let lip_up = Vec3::new(
        0.0,
        open * hh * 0.012 - closed * hh * 0.004,
        round * hh * 0.02,
    );
    pose.translate[h.jaw] = Vec3::new(
        0.0,
        -open * hh * 0.12,
        -open * hh * 0.01 + round * hh * 0.01,
    );
    pose.translate[r.lip_upper] = lip_up;
    for (bone, s) in [(r.corner_left, 1.0f32), (r.corner_right, -1.0)] {
        pose.translate[bone] = Vec3::new(
            s * (wide * hh * 0.035 - round * hh * 0.032),
            -open * hh * 0.03,
            round * hh * 0.012,
        );
    }
    // Hampaat: korkeus kasvaa vain, kun suu on auki (tai F/V-muodossa huulen päällä).
    let teeth_h = unit(m.teeth) * (open * hh * 0.035 + hh * 0.01);
    pose.translate[r.teeth] = lip_up - Vec3::Y * teeth_h;
    pose.translate[r.tongue] = Vec3::new(0.0, unit(m.tongue) * open.max(0.3) * hh * 0.05, 0.0);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::humanoid::Proportions;
    use hs_lipsync::Viseme;

    #[test]
    fn visemes_move_the_mouth_bones() {
        let h = Humanoid::new(Proportions::default());
        let mut pose = Pose::rest(&h.skeleton);
        apply_mouth(&h, &mut pose, &Viseme::Rest.shape());
        let world = h.skeleton.world(&pose);
        let gap_rest = world[h.mouth.lip_upper].pos.y - world[h.jaw].pos.y;
        apply_mouth(&h, &mut pose, &Viseme::Ah.shape());
        let world = h.skeleton.world(&pose);
        let gap_ah = world[h.mouth.lip_upper].pos.y - world[h.jaw].pos.y;
        assert!(
            gap_ah > gap_rest + h.head_height * 0.08,
            "{gap_rest} {gap_ah}"
        );
        let width_ah = world[h.mouth.corner_left].pos.x - world[h.mouth.corner_right].pos.x;
        apply_mouth(&h, &mut pose, &Viseme::Oo.shape());
        let world = h.skeleton.world(&pose);
        let width_oo = world[h.mouth.corner_left].pos.x - world[h.mouth.corner_right].pos.x;
        assert!(width_oo < width_ah - h.head_height * 0.05);
        // Hampaat näkyvät F/V:ssä, eivät levossa.
        apply_mouth(&h, &mut pose, &Viseme::Rest.shape());
        assert!(
            (pose.translate[h.mouth.teeth] - pose.translate[h.mouth.lip_upper]).length() < 1e-6
        );
        apply_mouth(&h, &mut pose, &Viseme::Fv.shape());
        assert!(
            pose.translate[h.mouth.lip_upper].y - pose.translate[h.mouth.teeth].y
                > h.head_height * 0.005
        );
    }
    #[test]
    fn malformed_and_extreme_channels_cannot_poison_or_overstretch_the_rig() {
        let h = Humanoid::new(Proportions::default());
        for value in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY, -1000., 1000.] {
            let mut pose = Pose::rest(&h.skeleton);
            apply_mouth(
                &h,
                &mut pose,
                &MouthShape {
                    open: value,
                    closed: value,
                    wide: value,
                    round: value,
                    teeth: value,
                    tongue: value,
                },
            );
            for t in &pose.translate {
                assert!(t.is_finite());
                assert!(t.abs().max_element() <= h.head_height * 0.13);
            }
            assert!(h.skeleton.world(&pose).iter().all(|j| j.pos.is_finite()));
        }
    }
}
