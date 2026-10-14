//! Deterministic expression overlay on the existing mouth rig.
//!
//! Apply once after the final viseme mouth pose for each freshly sampled frame.
//! Eyes and eyebrows are currently rigid geometry; this overlay does not claim
//! to animate them. Speech owns jaw closure, so idle expression opening never
//! overrides a speaking viseme.

use crate::{Humanoid, Pose};
use hs_core::Expression;

pub fn apply_expression(h: &Humanoid, pose: &mut Pose, expression: Expression, speaking: bool) {
    apply_offsets(h, pose, offsets(expression), speaking);
}

fn offsets(expression: Expression) -> (f32, f32, f32) {
    match expression {
        Expression::Neutral => (0.0, 0.0, 0.0),
        Expression::Happy => (0.027, 0.016, 0.0),
        Expression::Angry => (-0.012, -0.008, 0.0),
        Expression::Sad => (-0.028, 0.0, 0.0),
        Expression::Surprised => (0.008, -0.021, 0.065),
        Expression::Scared => (-0.019, 0.011, 0.025),
    }
}

/// Blend an authored expression change on a freshly sampled viseme pose.
/// `progress` is normalized transition time, not a frame accumulator, so
/// seeking, repeated samples and offline exports produce identical poses.
/// Smoothstep has zero velocity at both ends and never overshoots either
/// expression. Nonfinite progress leaves the previous expression in place.
pub fn apply_expression_blend(
    h: &Humanoid,
    pose: &mut Pose,
    from: Expression,
    to: Expression,
    progress: f32,
    speaking: bool,
) {
    let t = if progress.is_finite() {
        progress.clamp(0.0, 1.0)
    } else {
        0.0
    };
    let t = t * t * (3.0 - 2.0 * t);
    let (ay, aw, ao) = offsets(from);
    let (by, bw, bo) = offsets(to);
    apply_offsets(
        h,
        pose,
        (ay + (by - ay) * t, aw + (bw - aw) * t, ao + (bo - ao) * t),
        speaking,
    );
}

fn apply_offsets(h: &Humanoid, pose: &mut Pose, values: (f32, f32, f32), speaking: bool) {
    let (corner_y, widen, idle_open) = values;
    for (joint, sign) in [(h.mouth.corner_left, 1.0), (h.mouth.corner_right, -1.0)] {
        pose.translate[joint].y += h.head_height * corner_y;
        pose.translate[joint].x += sign * h.head_height * widen;
    }
    if !speaking {
        pose.translate[h.jaw].y -= idle_open * h.head_height;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{face::apply_mouth, Proportions};
    use hs_lipsync::Viseme;

    #[test]
    fn smile_and_sadness_curve_mouth_in_opposite_directions() {
        let h = Humanoid::new(Proportions::default());
        let mut smile = Pose::rest(&h.skeleton);
        let mut sad = smile.clone();
        apply_mouth(&h, &mut smile, &Viseme::Rest.shape());
        apply_mouth(&h, &mut sad, &Viseme::Rest.shape());
        apply_expression(&h, &mut smile, Expression::Happy, false);
        apply_expression(&h, &mut sad, Expression::Sad, false);
        for joint in [h.mouth.corner_left, h.mouth.corner_right] {
            assert!(smile.translate[joint].y > 0.0);
            assert!(sad.translate[joint].y < 0.0);
            assert!(smile.translate[joint].y - sad.translate[joint].y > h.head_height * 0.05);
        }
    }

    #[test]
    fn expression_preserves_speaking_jaw_and_teeth_for_every_viseme() {
        let h = Humanoid::new(Proportions::default());
        for viseme in [Viseme::Rest, Viseme::Ah, Viseme::Oo, Viseme::Fv] {
            for expression in [
                Expression::Neutral,
                Expression::Happy,
                Expression::Angry,
                Expression::Sad,
                Expression::Surprised,
                Expression::Scared,
            ] {
                let mut pose = Pose::rest(&h.skeleton);
                apply_mouth(&h, &mut pose, &viseme.shape());
                let jaw = pose.translate[h.jaw];
                let teeth = pose.translate[h.mouth.teeth];
                let upper = pose.translate[h.mouth.lip_upper];
                apply_expression(&h, &mut pose, expression, true);
                assert_eq!(pose.translate[h.jaw], jaw);
                assert_eq!(pose.translate[h.mouth.teeth], teeth);
                assert_eq!(pose.translate[h.mouth.lip_upper], upper);
            }
        }
    }

    #[test]
    fn neutral_is_noop_and_surprise_only_opens_idle_jaw() {
        let h = Humanoid::new(Proportions::default());
        let mut pose = Pose::rest(&h.skeleton);
        apply_mouth(&h, &mut pose, &Viseme::Ah.shape());
        let before = pose.translate.clone();
        apply_expression(&h, &mut pose, Expression::Neutral, false);
        assert_eq!(pose.translate, before);
        apply_expression(&h, &mut pose, Expression::Surprised, false);
        assert!(pose.translate[h.jaw].y < before[h.jaw].y - h.head_height * 0.06);
    }
    #[test]
    fn expressive_transitions_are_continuous_bounded_and_preserve_speech_contacts() {
        let h = Humanoid::new(Proportions::default());
        let expressions = [
            Expression::Neutral,
            Expression::Happy,
            Expression::Angry,
            Expression::Sad,
            Expression::Surprised,
            Expression::Scared,
        ];
        for from in expressions {
            for to in expressions {
                let mut base = Pose::rest(&h.skeleton);
                apply_mouth(&h, &mut base, &Viseme::Ah.shape());
                let mut first = base.clone();
                apply_expression(&h, &mut first, from, true);
                let mut last = base.clone();
                apply_expression(&h, &mut last, to, true);
                let mut previous: Option<Pose> = None;
                for tick in 0..=1000 {
                    let mut pose = base.clone();
                    apply_expression_blend(&h, &mut pose, from, to, tick as f32 / 1000., true);
                    assert_eq!(pose.local, base.local);
                    assert_eq!(pose.root_pos, base.root_pos);
                    for (i, translation) in pose.translate.iter().enumerate() {
                        assert!(translation.is_finite());
                        if ![h.mouth.corner_left, h.mouth.corner_right].contains(&i) {
                            assert_eq!(*translation, base.translate[i]);
                        } else {
                            let lo = first.translate[i].min(last.translate[i]);
                            let hi = first.translate[i].max(last.translate[i]);
                            assert!((*translation - lo).min_element() >= -1e-7);
                            assert!((hi - *translation).min_element() >= -1e-7);
                            if let Some(old) = &previous {
                                assert!(
                                    translation.distance(old.translate[i]) < h.head_height * 0.0001
                                );
                            }
                        }
                    }
                    previous = Some(pose);
                }
            }
        }
    }

    #[test]
    fn blend_endpoints_seek_determinism_and_idle_jaw_are_bounded() {
        let h = Humanoid::new(Proportions::default());
        let sample = |t| {
            let mut pose = Pose::rest(&h.skeleton);
            apply_mouth(&h, &mut pose, &Viseme::Rest.shape());
            apply_expression_blend(
                &h,
                &mut pose,
                Expression::Happy,
                Expression::Surprised,
                t,
                false,
            );
            pose
        };
        assert_eq!(sample(0.37).translate, sample(0.37).translate);
        assert_eq!(sample(f32::NAN).translate, sample(0.).translate);
        assert_eq!(sample(-1.).translate, sample(0.).translate);
        assert_eq!(sample(2.).translate, sample(1.).translate);
        for tick in 0..=1000 {
            let pose = sample(tick as f32 / 1000.);
            assert!(pose.translate[h.jaw].y <= 0.);
            assert!(pose.translate[h.jaw].y >= -h.head_height * 0.065 - 1e-7);
            assert!(h
                .skeleton
                .world(&pose)
                .iter()
                .all(|j| j.pos.is_finite() && j.rot.is_finite()));
        }
    }
}
