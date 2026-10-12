use glam::{Mat4, Quat, Vec3};
use serde::{Deserialize, Serialize};

/// Nivel lepoasennossa. Lepoasennon kierrot ovat identiteettejä: kaikki
/// siirtymät on ilmaistu vanhemman koordinaatistossa, joka lepoasennossa
/// on maailman suuntainen. Tämä pitää IK:n ja kehityksen yksinkertaisena.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Joint {
    pub name: String,
    pub parent: Option<usize>,
    /// Paikka vanhemman koordinaatistossa (metreinä).
    pub offset: Vec3,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Skeleton {
    pub joints: Vec<Joint>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct JointWorld {
    pub rot: Quat,
    pub pos: Vec3,
}

impl JointWorld {
    pub fn matrix(&self) -> Mat4 {
        Mat4::from_rotation_translation(self.rot, self.pos)
    }
    pub fn transform_point(&self, p: Vec3) -> Vec3 {
        self.pos + self.rot * p
    }
}

/// Asento: juuren sijainti ja kierto maailmassa sekä jokaisen nivelen paikallinen kierto.
#[derive(Clone, Debug, PartialEq)]
pub struct Pose {
    pub root_pos: Vec3,
    pub root_rot: Quat,
    pub local: Vec<Quat>,
    /// Paikallinen lisäsiirto (esim. lantion pomppu), nivelkohtainen.
    pub translate: Vec<Vec3>,
}

impl Pose {
    pub fn rest(skeleton: &Skeleton) -> Pose {
        Pose {
            root_pos: Vec3::ZERO,
            root_rot: Quat::IDENTITY,
            local: vec![Quat::IDENTITY; skeleton.joints.len()],
            translate: vec![Vec3::ZERO; skeleton.joints.len()],
        }
    }

    /// Pallomainen sekoitus kahden asennon välillä.
    pub fn blend(&self, other: &Pose, w: f32) -> Pose {
        let w = w.clamp(0.0, 1.0);
        Pose {
            root_pos: self.root_pos.lerp(other.root_pos, w),
            root_rot: self.root_rot.slerp(other.root_rot, w),
            local: self.local.iter().zip(&other.local).map(|(a, b)| a.slerp(*b, w)).collect(),
            translate: self.translate.iter().zip(&other.translate).map(|(a, b)| a.lerp(*b, w)).collect(),
        }
    }
}

impl Skeleton {
    pub fn add(&mut self, name: &str, parent: Option<usize>, offset: Vec3) -> usize {
        if let Some(p) = parent {
            assert!(p < self.joints.len(), "vanhemman pitää olla ennen lasta");
        }
        self.joints.push(Joint { name: name.to_string(), parent, offset });
        self.joints.len() - 1
    }

    pub fn find(&self, name: &str) -> Option<usize> {
        self.joints.iter().position(|j| j.name == name)
    }

    pub fn len(&self) -> usize {
        self.joints.len()
    }

    pub fn is_empty(&self) -> bool {
        self.joints.is_empty()
    }

    /// Eteenpäin kinematiikka. Vanhemmat ovat aina ennen lapsia, joten yksi kierros riittää.
    pub fn world(&self, pose: &Pose) -> Vec<JointWorld> {
        let mut out: Vec<JointWorld> = Vec::with_capacity(self.joints.len());
        for (i, j) in self.joints.iter().enumerate() {
            let local_t = j.offset + pose.translate[i];
            let w = match j.parent {
                Some(p) => {
                    let parent = out[p];
                    JointWorld { rot: (parent.rot * pose.local[i]).normalize(), pos: parent.pos + parent.rot * local_t }
                }
                None => JointWorld {
                    rot: (pose.root_rot * pose.local[i]).normalize(),
                    pos: pose.root_pos + pose.root_rot * local_t,
                },
            };
            out.push(w);
        }
        out
    }

    /// Lepoasennon maailmapaikat (sidonta-asento).
    pub fn bind_positions(&self) -> Vec<Vec3> {
        self.world(&Pose::rest(self)).iter().map(|w| w.pos).collect()
    }

    /// Ihomatriisit: maailma * käänteinen sidonta.
    pub fn skin_matrices(&self, pose: &Pose) -> Vec<Mat4> {
        let bind = self.bind_positions();
        self.world(pose)
            .iter()
            .zip(bind)
            .map(|(w, b)| w.matrix() * Mat4::from_translation(-b))
            .collect()
    }

    /// Asettaa nivelen maailmakierron muuttamalla sen paikallista kiertoa.
    pub fn set_world_rotation(&self, pose: &mut Pose, joint: usize, world_rot: Quat) {
        let parent_rot = match self.joints[joint].parent {
            Some(p) => self.world(pose)[p].rot,
            None => pose.root_rot,
        };
        pose.local[joint] = (parent_rot.inverse() * world_rot).normalize();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fk_chains_rotations() {
        let mut s = Skeleton::default();
        let a = s.add("a", None, Vec3::ZERO);
        let b = s.add("b", Some(a), Vec3::X);
        let c = s.add("c", Some(b), Vec3::X);
        let mut pose = Pose::rest(&s);
        pose.local[a] = Quat::from_rotation_z(std::f32::consts::FRAC_PI_2);
        let w = s.world(&pose);
        assert!((w[c].pos - Vec3::new(0.0, 2.0, 0.0)).length() < 1e-5);
        let skin = s.skin_matrices(&pose);
        // Sidonta-asennon piste c:n kohdalla päätyy c:n uuteen paikkaan.
        assert!((skin[c].transform_point3(Vec3::new(2.0, 0.0, 0.0)) - w[c].pos).length() < 1e-5);
    }
}
