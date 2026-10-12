//! Deterministic expression overlay on the existing mouth rig.
//!
//! Apply once after the final viseme mouth pose for each freshly sampled frame.
//! Eyes and eyebrows are currently rigid geometry; this overlay does not claim
//! to animate them. Speech owns jaw closure, so idle expression opening never
//! overrides a speaking viseme.

use crate::{Humanoid, Pose};
use hs_core::Expression;

pub fn apply_expression(h: &Humanoid, pose: &mut Pose, expression: Expression, speaking: bool) {
    let (corner_y, widen, idle_open) = match expression {
        Expression::Neutral => (0.0, 0.0, 0.0),
        Expression::Happy => (0.027, 0.016, 0.0),
        Expression::Angry => (-0.012, -0.008, 0.0),
        Expression::Sad => (-0.028, 0.0, 0.0),
        Expression::Surprised => (0.008, -0.021, 0.065),
        Expression::Scared => (-0.019, 0.011, 0.025),
    };
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
}
