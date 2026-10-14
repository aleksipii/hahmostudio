//! Explicit bounded scenery; coordinates are metres, Y up, local +Z forward.
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum ScenerySpec {
    Door {
        id: String,
        hinge: [f32; 3],
        width: f32,
        height: f32,
        yaw_degrees: f32,
        handle_height: f32,
    },
    Stairs {
        id: String,
        origin: [f32; 3],
        width: f32,
        rise: f32,
        run: f32,
        steps: u8,
        yaw_degrees: f32,
    },
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum SceneryAction {
    OpenDoor { id: String, angle_degrees: f32 },
    CloseDoor { id: String },
    ClimbStairs { id: String, descending: bool },
}
impl ScenerySpec {
    pub fn id(&self) -> &str {
        match self {
            Self::Door { id, .. } | Self::Stairs { id, .. } => id,
        }
    }
    pub fn validate(&self) -> Result<(), String> {
        let id = self.id();
        if id.is_empty()
            || id.len() > 32
            || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
        {
            return Err("Invalid scenery identifier".into());
        }
        let valid = match self {
            Self::Door {
                hinge,
                width,
                height,
                yaw_degrees,
                handle_height,
                ..
            } => {
                hinge.iter().all(|v| v.is_finite() && v.abs() <= 5.)
                    && hinge[1] >= 0.
                    && (0.4..=1.5).contains(width)
                    && (0.8..=3.).contains(height)
                    && yaw_degrees.is_finite()
                    && yaw_degrees.abs() <= 360.
                    && (0.2..=*height - 0.1).contains(handle_height)
            }
            Self::Stairs {
                origin,
                width,
                rise,
                run,
                steps,
                yaw_degrees,
                ..
            } => {
                origin.iter().all(|v| v.is_finite() && v.abs() <= 5.)
                    && origin[1] >= 0.
                    && (0.4..=2.).contains(width)
                    && (0.03..=0.18).contains(rise)
                    && (0.2..=0.5).contains(run)
                    && (1..=12).contains(steps)
                    && yaw_degrees.is_finite()
                    && yaw_degrees.abs() <= 360.
            }
        };
        if valid {
            Ok(())
        } else {
            Err("Scenery dimensions are outside supported finite limits".into())
        }
    }
}
impl SceneryAction {
    pub fn id(&self) -> &str {
        match self {
            Self::OpenDoor { id, .. } | Self::CloseDoor { id } | Self::ClimbStairs { id, .. } => id,
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn malformed_dimensions_and_nonfinite_values_fail() {
        for rise in [f32::NAN, f32::INFINITY, 0., 1.] {
            assert!(ScenerySpec::Stairs {
                id: "stair".into(),
                origin: [0.; 3],
                width: 0.7,
                rise,
                run: 0.25,
                steps: 3,
                yaw_degrees: 0.
            }
            .validate()
            .is_err());
        }
        assert!(ScenerySpec::Door {
            id: "door".into(),
            hinge: [0.; 3],
            width: 0.8,
            height: 1.8,
            yaw_degrees: 0.,
            handle_height: 2.
        }
        .validate()
        .is_err());
    }
}
