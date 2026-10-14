//! Explicit channel reservations for the current procedural humanoid.
use crate::MotionKind;
pub const ROOT_LEGS_TORSO: u8 = 1;
pub const LEFT_ARM: u8 = 2;
pub const RIGHT_ARM: u8 = 4;
pub const HEAD: u8 = 8;
pub const FULL: u8 = 15;
pub fn channels(motion: MotionKind) -> u8 {
    match motion {
        MotionKind::Wait => 0,
        MotionKind::Walk(_) | MotionKind::Run(_) | MotionKind::WalkBackward => ROOT_LEGS_TORSO,
        MotionKind::Wave => LEFT_ARM,
        MotionKind::PointForward => RIGHT_ARM,
        MotionKind::Nod | MotionKind::ShakeHead => HEAD,
        MotionKind::Shrug | MotionKind::Clap => LEFT_ARM | RIGHT_ARM,
        _ => FULL,
    }
}
pub fn compatible(a: MotionKind, b: MotionKind) -> bool {
    channels(a) & channels(b) == 0
}
