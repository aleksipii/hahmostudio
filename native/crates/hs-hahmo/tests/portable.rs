use hs_hahmo::{PortableHistory, Project};
use std::{
    collections::BTreeMap,
    io::{Cursor, Write},
};
fn example() -> Vec<u8> {
    std::fs::read(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../Esimerkki-kavely.hahmo"
    ))
    .unwrap()
}
fn zip(files: &BTreeMap<String, Vec<u8>>) -> Vec<u8> {
    let mut out = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for (name, bytes) in files {
        out.start_file(name, zip::write::SimpleFileOptions::default())
            .unwrap();
        out.write_all(bytes).unwrap();
    }
    out.finish().unwrap().into_inner()
}
#[test]
fn lossless_unknown_metadata_resources_and_atomic_save() {
    let original = example();
    let p = Project::open(&original).unwrap();
    assert_eq!(p.encode().unwrap(), original);
    let mut files = p.resources().clone();
    files.remove("resource-manifest.json");
    files.insert("extras/vendor.bin".into(), vec![1, 2, 3, 4]);
    let mut meta = p.metadata().clone();
    meta["vendorExtension"] = serde_json::json!({"immutableId":"origin-42","custom":true});
    files.insert("project.json".into(), serde_json::to_vec(&meta).unwrap());
    let mut p = Project::open(&zip(&files)).unwrap();
    let key = p.document.layers[0].key.clone();
    meta["document"]["name"] = serde_json::json!("Native edit");
    p.replace_metadata(meta).unwrap();
    let saved = p.encode().unwrap();
    let read = Project::open(&saved).unwrap();
    assert_eq!(
        read.metadata()["vendorExtension"]["immutableId"],
        "origin-42"
    );
    assert_eq!(read.document.layers[0].key, key);
    assert_eq!(read.resources()["extras/vendor.bin"], [1, 2, 3, 4]);
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("test.hahmo");
    std::fs::write(&path, b"old").unwrap();
    p.save_atomic(&path).unwrap();
    assert_eq!(std::fs::read(&path).unwrap(), saved);
    let bad = directory.path().join("missing").join("test.hahmo");
    assert!(p.save_atomic(&bad).is_err());
    assert_eq!(std::fs::read(&path).unwrap(), saved);
}
#[test]
fn rejects_checksum_paths_missing_images_and_invalid_edit_without_mutation() {
    let mut p = Project::open(&example()).unwrap();
    let original = p.encode().unwrap();
    let image_path = p
        .resources()
        .keys()
        .find(|path| path.starts_with("images/"))
        .unwrap()
        .clone();
    assert!(p
        .replace_resource(&image_path, b"invalid png".to_vec())
        .is_err());
    assert_eq!(p.encode().unwrap(), original);
    let mut meta = p.metadata().clone();
    meta["document"]["layers"][0]["key"] = serde_json::json!("");
    assert!(p.replace_metadata(meta).is_err());
    assert_eq!(p.encode().unwrap(), original);
    let mut files = p.resources().clone();
    files.remove("resource-manifest.json");
    files.insert("../escape".into(), vec![0]);
    assert!(Project::open(&zip(&files)).is_err());
    files.remove("../escape");
    let image = files
        .keys()
        .find(|p| p.starts_with("images/"))
        .unwrap()
        .clone();
    files.remove(&image);
    assert!(Project::open(&zip(&files)).is_err());
    let mut meta = p.metadata().clone();
    meta["document"]["name"] = serde_json::json!("manifest added");
    p.replace_metadata(meta).unwrap();
    let read = Project::open(&p.encode().unwrap()).unwrap();
    let mut files = read.resources().clone();
    files.get_mut("project.json").unwrap().push(b' ');
    assert!(Project::open(&zip(&files)).is_err());
}
#[test]
fn portable_history_roundtrips_and_corruption_is_detected() {
    let original = example();
    let mut p = Project::open(&original).unwrap();
    let history = PortableHistory {
        past: vec![original.clone()],
        future: vec![original.clone()],
    };
    p.replace_history(&history).unwrap();
    let saved = p.encode().unwrap();
    let read = Project::open(&saved).unwrap();
    assert_eq!(read.history().unwrap(), Some(history));
    let mut files = read.resources().clone();
    files.remove("resource-manifest.json");
    let path = files
        .keys()
        .find(|p| p.starts_with("history/pool/"))
        .unwrap()
        .clone();
    files.get_mut(&path).unwrap()[0] ^= 1;
    let bad = Project::open(&zip(&files));
    assert!(bad.is_err() || bad.unwrap().history().is_err());
    let before = p.encode().unwrap();
    assert!(p
        .replace_history(&PortableHistory {
            past: vec![saved],
            future: vec![]
        })
        .is_err());
    assert_eq!(p.encode().unwrap(), before);
}
#[test]
fn opens_all_preserved_library_archives_losslessly() {
    let library = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../public/library");
    for entry in std::fs::read_dir(library).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().is_some_and(|e| e == "hahmo") {
            let bytes = std::fs::read(&path).unwrap();
            let project =
                Project::open(&bytes).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
            assert_eq!(project.encode().unwrap(), bytes);
        }
    }
}
#[test]
fn duplicate_zip_names_and_direct_field_mutations_are_rejected() {
    let mut p = Project::open(&example()).unwrap();
    p.document.name = "unsaved direct edit".into();
    assert!(p.encode().is_err());
    let mut files = BTreeMap::new();
    files.insert("duplicate-a".into(), vec![0]);
    files.insert("duplicate-b".into(), vec![1]);
    let mut bytes = zip(&files);
    let old = b"duplicate-b";
    let new = b"duplicate-a";
    for i in 0..bytes.len() - old.len() {
        if &bytes[i..i + old.len()] == old {
            bytes[i..i + old.len()].copy_from_slice(new);
        }
    }
    assert!(Project::open(&bytes).is_err());
}
#[test]
fn reads_legacy_v1_portable_history() {
    use sha2::{Digest, Sha256};
    let original = example();
    let p = Project::open(&original).unwrap();
    let mut files = p.resources().clone();
    files.remove("resource-manifest.json");
    files.insert("history/0.hahmo".into(), original.clone());
    files.insert("history.json".into(),serde_json::to_vec(&serde_json::json!({"version":1,"past":1,"entries":[{"path":"history/0.hahmo","hash":format!("{:x}",Sha256::digest(&original))}]})).unwrap());
    assert_eq!(
        Project::open(&zip(&files))
            .unwrap()
            .history()
            .unwrap()
            .unwrap()
            .past,
        vec![original]
    );
}
