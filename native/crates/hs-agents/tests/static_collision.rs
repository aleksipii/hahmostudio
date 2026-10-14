use glam::{Quat, Vec3};
use hs_agents::{
    collision::{body_capsules, BodyCapsule, CollisionPlan, StaticMeshCollider},
    Pipeline, Production,
};
use hs_character::MeshBuilder;
fn capsule(x: f32) -> BodyCapsule {
    BodyCapsule {
        a: Vec3::new(x, 0.5, 0.),
        b: Vec3::new(x, 1.5, 0.),
        radius: 0.1,
    }
}
#[test]
fn thin_wall_sweep_blocks_tunneling_even_when_endpoints_are_clear() {
    let mut b = MeshBuilder::new();
    b.quad(
        [
            Vec3::new(0., 0., -2.),
            Vec3::new(0., 2., -2.),
            Vec3::new(0., 2., 2.),
            Vec3::new(0., 0., 2.),
        ],
        [[255; 3]; 4],
        1.,
    );
    let mesh = b.finish();
    let c = StaticMeshCollider::from_mesh(&mesh).unwrap();
    assert!(!c.intersects(capsule(-1.)).unwrap());
    assert!(!c.intersects(capsule(1.)).unwrap());
    assert!(c.swept_intersects(capsule(-1.), capsule(1.)).unwrap());
    assert!(!c.swept_intersects(capsule(-2.), capsule(-1.)).unwrap());
}
#[test]
fn floor_support_is_allowed_but_penetration_and_low_obstacles_are_blocked() {
    let mut b = MeshBuilder::new();
    b.quad(
        [
            Vec3::new(-2., 0., -2.),
            Vec3::new(-2., 0., 2.),
            Vec3::new(2., 0., 2.),
            Vec3::new(2., 0., -2.),
        ],
        [[255; 3]; 4],
        1.,
    );
    let floor = StaticMeshCollider::from_mesh(&b.finish()).unwrap();
    let support = BodyCapsule {
        a: Vec3::new(0., 0.1, 0.),
        b: Vec3::new(0., 1., 0.),
        radius: 0.1,
    };
    assert!(!floor.intersects(support).unwrap());
    assert!(!floor.swept_intersects(support, support).unwrap());
    let below = BodyCapsule {
        a: Vec3::new(0., 0.04, 0.),
        ..support
    };
    assert!(floor.intersects(below).unwrap());
    let mut b = MeshBuilder::new();
    b.cuboid(
        Vec3::new(0., 0.15, 0.),
        Vec3::new(0.2, 0.15, 0.2),
        Quat::IDENTITY,
        [100; 3],
        1.,
    );
    let box_collider = StaticMeshCollider::from_mesh(&b.finish()).unwrap();
    let shin = BodyCapsule {
        a: Vec3::new(0., 0.6, 0.),
        b: Vec3::new(0., 0.07, 0.),
        radius: 0.05,
    };
    assert!(box_collider.intersects(shin).unwrap());
}
fn ready() -> Production {
    let mut p = Production::new("KALLE: [wait 4s]");
    Pipeline::default().run(&mut p).unwrap();
    p
}
#[test]
fn actual_environment_couch_blocks_authored_root_path_without_moving_actor() {
    let mut p = Production::new("[background living room]\nKALLE: [wait 4s]");
    Pipeline::default().run(&mut p).unwrap();
    let key = |time, translation| {
        hs_motion::pose_edit::PoseKey::from_euler_degrees(
            time,
            [0.; 3],
            translation,
            hs_motion::pose_edit::Interpolation::Linear,
        )
    };
    p.pose_tracks
        .upsert("Kalle", None, key(0., [-1.6, 0., 0.]))
        .unwrap();
    p.pose_tracks
        .upsert("Kalle", None, key(4., [-1.6, 0., -4.]))
        .unwrap();
    let error = match CollisionPlan::build(&p) {
        Ok(_) => panic!("Couch collision was not rejected"),
        Err(e) => e,
    };
    assert!(error.contains("Rivi 2"), "{error}");
    assert!(error.contains("apartment-v1"), "{error}");
    assert_eq!(p.pose_tracks.tracks[0].keys[1].translation, [-1.6, 0., -4.]);
}
#[test]
fn unchanged_clear_scene_reuses_geometry_and_stale_or_malformed_poses_fail() {
    let mut p = ready();
    let plan = CollisionPlan::build(&p).unwrap().unwrap();
    let mut frames = p
        .motion
        .iter()
        .map(|m| m.evaluate(p.timeline.as_ref().unwrap(), 2.))
        .collect::<Vec<_>>();
    assert!(plan.matches(&p));
    plan.evaluate(&p, 2., &frames).unwrap();
    let original = body_capsules(&p.cast[0].character, &frames[0]).unwrap();
    frames[0].pose.root_pos.y -= 0.1;
    let lower = body_capsules(&p.cast[0].character, &frames[0]).unwrap();
    assert!((original[0].a.y - lower[0].a.y - 0.1).abs() < 1e-5);
    frames[0].pose.local.clear();
    assert!(plan.evaluate(&p, 2., &frames).is_err());
    p.pose_tracks
        .upsert(
            "Kalle",
            None,
            hs_motion::pose_edit::PoseKey::from_euler_degrees(
                0.,
                [0.; 3],
                [0.; 3],
                hs_motion::pose_edit::Interpolation::Linear,
            ),
        )
        .unwrap();
    assert!(!plan.matches(&p));
}
#[test]
fn malformed_geometry_and_nonfinite_queries_are_rejected() {
    let mesh = hs_character::CharacterMesh {
        indices: vec![0, 1, 2],
        ..Default::default()
    };
    assert!(StaticMeshCollider::from_mesh(&mesh).is_err());
    let c = StaticMeshCollider::from_mesh(&hs_character::CharacterMesh::default()).unwrap();
    assert!(c
        .intersects(BodyCapsule {
            radius: f32::NAN,
            ..capsule(0.)
        })
        .is_err());
}
#[test]
fn starting_inside_a_closed_solid_is_rejected_but_open_planes_are_not_volumes() {
    let mut b = MeshBuilder::new();
    b.cuboid(
        Vec3::new(0., 1., 0.),
        Vec3::new(2., 2., 2.),
        Quat::IDENTITY,
        [100; 3],
        1.,
    );
    let collider = StaticMeshCollider::from_mesh(&b.finish()).unwrap();
    let c = capsule(0.);
    assert!(collider.intersects(c).unwrap());
    assert!(collider.swept_intersects(c, c).unwrap());
    let mut b = MeshBuilder::new();
    for x in [-2., 2.] {
        b.quad(
            [
                Vec3::new(x, 0., -2.),
                Vec3::new(x, 3., -2.),
                Vec3::new(x, 3., 2.),
                Vec3::new(x, 0., 2.),
            ],
            [[255; 3]; 4],
            1.,
        );
    }
    let corridor = StaticMeshCollider::from_mesh(&b.finish()).unwrap();
    assert!(!corridor.intersects(c).unwrap());
}
