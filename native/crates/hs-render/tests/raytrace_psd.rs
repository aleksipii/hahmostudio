use glam::{Quat, Vec3};
use hs_character::mesh::MeshBuilder;
use hs_render::{
    psd_exporter,
    raytrace::{self, RayTraceOptions},
    Camera, DrawItem, Lights, RenderScene, ShadingStyle,
};
use std::sync::Arc;
fn scene() -> RenderScene {
    let mut mesh = MeshBuilder::new();
    mesh.cuboid(
        Vec3::ZERO,
        Vec3::splat(0.5),
        Quat::IDENTITY,
        [200, 80, 40],
        1.0,
    );
    mesh.cuboid(
        Vec3::new(0.0, -0.6, 0.0),
        Vec3::new(2.0, 0.1, 2.0),
        Quat::IDENTITY,
        [150, 150, 150],
        1.0,
    );
    RenderScene {
        width: 32,
        height: 32,
        camera: Camera {
            eye: Vec3::new(0.0, 0.6, 3.0),
            target: Vec3::ZERO,
            fov_y: 50.0,
        },
        lights: Lights::default(),
        style: ShadingStyle::Flat,
        clear: [20, 30, 40],
        outline: 0.0,
        items: vec![DrawItem::rigid(Arc::new(mesh.finish()))],
    }
}
#[test]
fn ray_hits_aligned_layers_occlusion_and_psd_roundtrip() {
    let options = RayTraceOptions {
        ao_samples: 32,
        depth_far: 10.0,
        threads: 1,
        ..Default::default()
    };
    let buffers = raytrace::render(&scene(), options).unwrap();
    buffers.validate().unwrap();
    let covered: Vec<_> = buffers
        .diffuse
        .chunks_exact(4)
        .enumerate()
        .filter(|(_, p)| p[3] == 255)
        .collect();
    assert!(covered.len() > 100);
    assert!(buffers
        .ambient_occlusion
        .chunks_exact(4)
        .any(|p| p[3] == 255 && p[0] < 255));
    assert!(buffers
        .specular
        .chunks_exact(4)
        .any(|p| p[3] == 255 && p[0] > 0));
    for (i, _) in covered {
        assert_eq!(buffers.normal[i * 4 + 3], 255);
        assert_eq!(buffers.depth[i * 4 + 3], 255);
        assert!(buffers.depth[i * 4] > 0);
    }
    let bytes = psd_exporter::encode(&buffers).unwrap();
    let psd = psd::Psd::from_bytes(&bytes).unwrap();
    assert_eq!((psd.width(), psd.height()), (32, 32));
    assert_eq!(psd.layers().len(), 6);
    assert_eq!(
        psd.layer_by_name("Diffuse / Base Color").unwrap().rgba(),
        buffers.diffuse
    );
    // psd 0.3.5 reverses the Photoshop visibility flag; independent importer checks it.
    let document = hs_image::Document::import_psd(&bytes).unwrap();
    assert!(
        !document
            .layers
            .iter()
            .find(|l| l.name == "Depth Map")
            .unwrap()
            .visible
    );
    assert!(
        !document
            .layers
            .iter()
            .find(|l| l.name == "Normal Map")
            .unwrap()
            .visible
    );
    assert_eq!(
        format!(
            "{:?}",
            psd.layer_by_name("Ambient Occlusion").unwrap().blend_mode()
        ),
        "Multiply"
    );
    assert_eq!(
        format!("{:?}", psd.layer_by_name("Specular").unwrap().blend_mode()),
        "Screen"
    );
    let parallel = raytrace::render(
        &scene(),
        RayTraceOptions {
            threads: 4,
            ..options
        },
    )
    .unwrap();
    assert_eq!(parallel.diffuse, buffers.diffuse);
    assert_eq!(parallel.ambient_occlusion, buffers.ambient_occlusion);
    assert_eq!(parallel.normal, buffers.normal);
}
#[test]
fn invalid_geometry_buffers_and_failed_export_preserve_target() {
    let mut scene = scene();
    scene.items[0].mesh = Arc::new(hs_character::CharacterMesh {
        vertices: Vec::new(),
        indices: vec![0, 1, 2],
    });
    assert!(raytrace::render(&scene, Default::default()).is_err());
    let mut buffers = raytrace::render(&self::scene(), Default::default()).unwrap();
    buffers.depth.pop();
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("existing.psd");
    std::fs::write(&path, b"keep").unwrap();
    assert!(psd_exporter::save_atomic(&buffers, &path).is_err());
    assert_eq!(std::fs::read(path).unwrap(), b"keep");
}
#[test]
fn character_mesh_and_empty_scene() {
    let mut scene = scene();
    scene.items.clear();
    let empty = raytrace::render(&scene, Default::default()).unwrap();
    assert!(empty.diffuse.iter().all(|v| *v == 0));
    assert!(psd_exporter::encode(&empty).is_ok());
    let character = hs_character::Character::build(hs_character::CharacterParams::kalle());
    scene.items.push(DrawItem::rigid(Arc::new(character.mesh)));
    scene.camera.eye = Vec3::new(0.0, 1.0, 4.0);
    scene.camera.target = Vec3::new(0.0, 1.0, 0.0);
    let buffers = raytrace::render(
        &scene,
        RayTraceOptions {
            ao_samples: 0,
            ..Default::default()
        },
    )
    .unwrap();
    assert!(buffers.diffuse.chunks_exact(4).any(|p| p[3] == 255));
    assert!(psd_exporter::encode(&buffers).is_ok());
}

#[test]
fn analytical_depth_normals_skin_and_cancellation() {
    let mut mesh = MeshBuilder::new();
    mesh.cuboid(
        Vec3::ZERO,
        Vec3::splat(0.5),
        Quat::IDENTITY,
        [200, 80, 40],
        1.0,
    );
    let mut s = scene();
    s.width = 1;
    s.height = 1;
    s.camera = Camera {
        eye: Vec3::new(0.0, 0.0, 3.0),
        target: Vec3::ZERO,
        fov_y: 50.0,
    };
    s.items = vec![DrawItem::rigid(Arc::new(mesh.finish()))];
    let opts = RayTraceOptions {
        ao_samples: 0,
        depth_near: 0.0,
        depth_far: 5.0,
        threads: 1,
        ..Default::default()
    };
    let a = raytrace::render(&s, opts).unwrap();
    assert_eq!(a.depth, [128, 128, 128, 255]);
    assert_eq!(a.normal, [128, 128, 255, 255]);
    assert_eq!(a.diffuse, [200, 80, 40, 255]);
    assert_eq!(a.ambient_occlusion, [255; 4]);
    s.items[0].skin = vec![glam::Mat4::from_translation(Vec3::new(0.0, 0.0, 1.0))];
    let b = raytrace::render(&s, opts).unwrap();
    assert_eq!(b.depth, [179, 179, 179, 255]);
    let signal = std::sync::atomic::AtomicBool::new(true);
    assert!(raytrace::render_cancelable(&s, opts, &signal).is_err());
    s.camera.target = s.camera.eye;
    assert!(raytrace::render(&s, opts).is_err());
}

#[test]
fn raster_shadow_decorations_do_not_contaminate_base_colour() {
    let mut s=scene();let before=raytrace::render(&s,RayTraceOptions{ao_samples:0,..Default::default()}).unwrap();
    let mut decoration=MeshBuilder::new();decoration.cuboid(Vec3::new(0.0,0.0,2.0),Vec3::splat(0.5),Quat::IDENTITY,[0,0,0],1.0);
    s.items.push(DrawItem::rigid(Arc::new(decoration.finish())).raster_only());
    let after=raytrace::render(&s,RayTraceOptions{ao_samples:0,..Default::default()}).unwrap();assert_eq!(before.diffuse,after.diffuse);assert_eq!(before.depth,after.depth);
}

#[test]
fn depth_range_does_not_clip_geometry_and_ao_strength_is_independent(){
 let scene=scene();let full=raytrace::render(&scene,RayTraceOptions{ao_samples:32,..Default::default()}).unwrap();
 let remapped=raytrace::render(&scene,RayTraceOptions{ao_samples:32,ao_strength:0.0,depth_near:0.0,depth_far:0.1,..Default::default()}).unwrap();
 assert_eq!(full.diffuse,remapped.diffuse);assert_eq!(full.normal,remapped.normal);assert_eq!(full.specular,remapped.specular);
 assert_ne!(full.depth,remapped.depth);assert_ne!(full.ambient_occlusion,remapped.ambient_occlusion);
 assert!(remapped.ambient_occlusion.chunks_exact(4).filter(|p|p[3]>0).all(|p|p[0]==255));
}
