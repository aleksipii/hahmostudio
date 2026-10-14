//! Bounded, local recovery archives. Use one writer per recovery root.
//! Files are verified before publication; this is not a power-loss guarantee.
use crate::{encode, id_valid, invalid, load, save_atomic, ProjectError, Series};
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug)]
pub struct RecoveryStore {
    root: PathBuf,
    quota_bytes: u64,
}
#[derive(Debug)]
pub struct RecoveredSnapshot {
    pub path: PathBuf,
    pub series: Series,
    pub sequence: u64,
    pub named: bool,
}
impl RecoveryStore {
    pub fn new(root: impl Into<PathBuf>, quota_bytes: u64) -> Self {
        Self {
            root: root.into(),
            quota_bytes,
        }
    }
    fn directory(&self, id: &str) -> Result<PathBuf, ProjectError> {
        if !id_valid(id) {
            return Err(invalid("unsafe recovery series ID"));
        }
        reject_symlink_components(&self.root)?;
        let dir = self.root.join(id);
        reject_symlink_components(&dir)?;
        Ok(dir)
    }
    /// Publishes a verified snapshot alongside the newest valid previous autosave.
    /// Quota includes the candidate alongside existing files; failure does not
    /// delete a last-good archive or any named revision.
    pub fn autosave(&self, series: &Series) -> Result<PathBuf, ProjectError> {
        self.write(series, None)
    }
    /// Named revisions are immutable and never automatically deleted.
    pub fn save_revision(&self, series: &Series, name: &str) -> Result<PathBuf, ProjectError> {
        if !id_valid(name) {
            return Err(invalid("unsafe revision name"));
        }
        self.write(series, Some(name))
    }
    fn write(&self, series: &Series, name: Option<&str>) -> Result<PathBuf, ProjectError> {
        self.write_with(series, name, save_atomic)
    }
    // Keep the publication boundary injectable to exercise storage failures
    // without relying on platform-specific permission behaviour.
    fn write_with(
        &self,
        series: &Series,
        name: Option<&str>,
        publish: impl FnOnce(&Path, &Series) -> Result<(), ProjectError>,
    ) -> Result<PathBuf, ProjectError> {
        let dir = self.directory(&series.id)?;
        let bytes = encode(series)?;
        let used = usage(&self.root)?;
        if used
            .checked_add(bytes.len() as u64)
            .map_or(true, |n| n > self.quota_bytes)
        {
            return Err(invalid(
                "recovery quota exceeded; previous snapshots preserved",
            ));
        }
        fs::create_dir_all(&dir)?;
        let files = archives(&dir)?;
        let sequence = files
            .iter()
            .map(|(_, seq, _)| *seq)
            .max()
            .unwrap_or(0)
            .checked_add(1)
            .ok_or_else(|| invalid("recovery sequence exhausted"))?;
        let filename = match name {
            Some(name) => format!("revision-{sequence:020}-{name}.koeta"),
            None => format!("autosave-{sequence:020}.koeta"),
        };
        if let Some(name) = name {
            if files.iter().any(|(path, _, named)| {
                *named
                    && path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .and_then(|n| n.strip_prefix("revision-"))
                        .and_then(|n| n.strip_suffix(".koeta"))
                        .and_then(|n| n.split_once('-'))
                        .is_some_and(|(_, label)| label == name)
            }) {
                return Err(invalid("named revision already exists"));
            }
        }
        let target = dir.join(filename);
        if target.exists() {
            return Err(invalid("recovery destination exists"));
        }
        let mut obsolete = Vec::new();
        if name.is_none() {
            let mut autosaves: Vec<_> = files.into_iter().filter(|(_, _, named)| !named).collect();
            autosaves.sort_by_key(|(_, seq, _)| std::cmp::Reverse(*seq));
            // Determine retention without changing any previous snapshot.
            // Never favour a newer corrupt archive over a validated fallback.
            let keep = autosaves
                .iter()
                .find_map(|(path, _, _)| {
                    load(path)
                        .ok()
                        .filter(|s| s.id == series.id)
                        .map(|_| path.clone())
                })
                .or_else(|| autosaves.first().map(|(path, _, _)| path.clone()));
            for (old, _, _) in autosaves {
                if Some(&old) != keep.as_ref() {
                    obsolete.push(old);
                }
            }
        }
        // Publication must succeed before rotation can discard any fallback.
        // Interruption here can leave extra completed archives, which the next
        // successful write safely prunes. A cleanup error may leave the newly
        // published snapshot alongside older files, never remove the candidate.
        publish(&target, series)?;
        for old in obsolete {
            fs::remove_file(old)?;
        }
        Ok(target)
    }
    /// Returns the newest fully validated archive, falling back past corruption.
    pub fn latest(&self, series_id: &str) -> Result<Option<RecoveredSnapshot>, ProjectError> {
        let dir = self.directory(series_id)?;
        let mut files = archives(&dir)?;
        files.sort_by_key(|(_, seq, _)| std::cmp::Reverse(*seq));
        for (path, sequence, named) in files {
            if let Ok(series) = load(&path) {
                if series.id == series_id {
                    return Ok(Some(RecoveredSnapshot {
                        path,
                        series,
                        sequence,
                        named,
                    }));
                }
            }
        }
        Ok(None)
    }
    /// One latest validated candidate per series; unknown files are never opened.
    pub fn discover(&self) -> Result<Vec<RecoveredSnapshot>, ProjectError> {
        reject_symlink_components(&self.root)?;
        if !self.root.exists() {
            return Ok(Vec::new());
        }
        let mut found = Vec::new();
        for (index, entry) in fs::read_dir(&self.root)?.enumerate() {
            if index >= 16384 {
                return Err(invalid("recovery entry count limit"));
            }
            let entry = entry?;
            if entry.file_type()?.is_symlink() {
                return Err(invalid("symlink in recovery store"));
            }
            if !entry.file_type()?.is_dir() {
                continue;
            }
            if let Some(id) = entry.file_name().to_str().filter(|id| id_valid(id)) {
                if let Some(snapshot) = self.latest(id)? {
                    found.push(snapshot);
                }
            }
        }
        found.sort_by(|a, b| a.series.id.cmp(&b.series.id));
        Ok(found)
    }
}
fn reject_symlink_components(path: &Path) -> Result<(), ProjectError> {
    if path
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(invalid("parent traversal in recovery path"));
    }
    let mut current = PathBuf::new();
    for component in path.components() {
        current.push(component);
        match fs::symlink_metadata(&current) {
            Ok(meta) if meta.file_type().is_symlink() => {
                return Err(invalid("symlink in recovery path"))
            }
            Ok(_) => (),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(e.into()),
        }
    }
    Ok(())
}
fn archive_name(name: &str) -> Option<(u64, bool)> {
    let stem = name.strip_suffix(".koeta")?;
    if let Some(seq) = stem.strip_prefix("autosave-") {
        if seq.len() == 20 && seq.bytes().all(|b| b.is_ascii_digit()) {
            return Some((seq.parse().ok()?, false));
        }
    }
    let rest = stem.strip_prefix("revision-")?;
    let (seq, label) = rest.split_once('-')?;
    if seq.len() == 20 && seq.bytes().all(|b| b.is_ascii_digit()) && id_valid(label) {
        Some((seq.parse().ok()?, true))
    } else {
        None
    }
}
fn archives(dir: &Path) -> Result<Vec<(PathBuf, u64, bool)>, ProjectError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut found = Vec::new();
    for (index, entry) in fs::read_dir(dir)?.enumerate() {
        if index >= 16384 {
            return Err(invalid("recovery entry count limit"));
        }
        let entry = entry?;
        if entry.file_type()?.is_symlink() {
            return Err(invalid("symlink in recovery directory"));
        }
        if !entry.file_type()?.is_file() {
            continue;
        }
        if let Some((seq, named)) = entry.file_name().to_str().and_then(archive_name) {
            found.push((entry.path(), seq, named));
        }
    }
    Ok(found)
}
fn usage(root: &Path) -> Result<u64, ProjectError> {
    reject_symlink_components(root)?;
    if !root.exists() {
        return Ok(0);
    }
    let mut bytes = 0u64;
    let mut visited = 0usize;
    let mut pending = vec![(root.to_path_buf(), 0usize)];
    while let Some((directory, depth)) = pending.pop() {
        for entry in fs::read_dir(directory)? {
            let entry = entry?;
            visited += 1;
            if visited > 16384 {
                return Err(invalid("recovery entry count limit"));
            }
            let kind = entry.file_type()?;
            if kind.is_symlink() {
                return Err(invalid("symlink in recovery store"));
            }
            if kind.is_dir() {
                if depth >= 1 {
                    return Err(invalid("unexpected nested recovery directory"));
                }
                pending.push((entry.path(), depth + 1));
            } else {
                bytes = bytes
                    .checked_add(entry.metadata()?.len())
                    .ok_or_else(|| invalid("recovery usage overflow"))?;
            }
        }
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn series() -> Series {
        Series {
            id: "family".into(),
            name: "My series".into(),
            episodes: vec![crate::Episode {
                id: "episode-1".into(),
                number: 1,
                name: "Hello".into(),
                script: "KALLE: Hello!".into(),
                cast: vec![hs_character::CharacterParams::kalle()],
                fps: 30,
                width: 1920,
                height: 1080,
                captions: Vec::new(),
                caption_settings: Default::default(),
                assets: Vec::new(),
                accepted_notices: std::collections::BTreeSet::new(),
                audio: Vec::new(),
            }],
        }
    }
    #[test]
    fn restart_rotation_preserves_named_and_user_project() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("recovery");
        let store = RecoveryStore::new(&root, 1024 * 1024);
        let user = dir.path().join("user.koeta");
        save_atomic(&user, &series()).unwrap();
        let before = fs::read(&user).unwrap();
        let named = store.save_revision(&series(), "pilot").unwrap();
        for i in 0..5 {
            let mut s = series();
            s.name = format!("draft {i}");
            store.autosave(&s).unwrap();
        }
        assert_eq!(archives(&root.join("family")).unwrap().len(), 3);
        let restarted = RecoveryStore::new(&root, 1024 * 1024);
        assert_eq!(
            restarted.latest("family").unwrap().unwrap().series.name,
            "draft 4"
        );
        assert_eq!(restarted.discover().unwrap().len(), 1);
        assert!(named.exists());
        assert!(store.save_revision(&series(), "pilot").is_err());
        assert_eq!(fs::read(user).unwrap(), before);
    }
    #[test]
    fn revision_names_are_exact_not_suffix_matches() {
        let dir = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(dir.path(), 1024 * 1024);
        let first = store.save_revision(&series(), "final-review").unwrap();
        let second = store.save_revision(&series(), "review").unwrap();
        assert_ne!(first, second);
        assert!(store.save_revision(&series(), "review").is_err());
    }
    #[test]
    fn corrupt_latest_and_interrupted_write_fall_back_to_good() {
        let dir = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(dir.path(), 1024 * 1024);
        let good = store.autosave(&series()).unwrap();
        let bad = store.autosave(&series()).unwrap();
        fs::write(bad, b"truncated archive").unwrap();
        fs::write(dir.path().join("family/.unfinished"), b"partial").unwrap();
        assert_eq!(store.latest("family").unwrap().unwrap().path, good);
    }
    #[test]
    fn next_write_keeps_valid_older_when_newer_is_corrupt() {
        let dir = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(dir.path(), 1024 * 1024);
        let good = store.autosave(&series()).unwrap();
        let bad = store.autosave(&series()).unwrap();
        fs::write(&bad, b"broken").unwrap();
        let newest = store.autosave(&series()).unwrap();
        assert!(good.exists());
        assert!(!bad.exists());
        assert_eq!(archives(&dir.path().join("family")).unwrap().len(), 2);
        fs::write(newest, b"later corruption").unwrap();
        assert_eq!(store.latest("family").unwrap().unwrap().path, good);
    }
    #[test]
    fn failed_publication_keeps_both_fallbacks_and_named_revision() {
        let dir = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(dir.path(), 1024 * 1024);
        let first = store.autosave(&series()).unwrap();
        let mut second_series = series();
        second_series.name = "Second draft".into();
        let second = store.autosave(&second_series).unwrap();
        let named = store.save_revision(&second_series, "approved").unwrap();
        let original: Vec<_> = [&first, &second, &named]
            .into_iter()
            .map(|path| (path.clone(), fs::read(path).unwrap()))
            .collect();
        let error = store.write_with(&series(), None, |_, _| {
            Err(std::io::Error::other("simulated storage write failure").into())
        });
        assert!(error.is_err());
        for (path, bytes) in &original {
            assert_eq!(&fs::read(path).unwrap(), bytes);
        }
        assert_eq!(archives(&dir.path().join("family")).unwrap().len(), 3);
        // A later corruption of both newest alternatives still has a fallback.
        fs::write(&second, b"corrupted after failed save").unwrap();
        fs::write(&named, b"corrupted revision").unwrap();
        assert_eq!(store.latest("family").unwrap().unwrap().path, first);
    }
    #[test]
    fn interrupted_rotation_is_finished_by_next_successful_publication() {
        let dir = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(dir.path(), 1024 * 1024);
        store.autosave(&series()).unwrap();
        let previous = store.autosave(&series()).unwrap();
        // Simulate death after atomic publication but before removing obsolete
        // files. The third complete archive is a recoverable state.
        let extra = dir.path().join("family/autosave-00000000000000000003.koeta");
        let mut interrupted = series();
        interrupted.name = "Published before interruption".into();
        save_atomic(&extra, &interrupted).unwrap();
        assert_eq!(store.latest("family").unwrap().unwrap().path, extra);
        let newest = store.autosave(&series()).unwrap();
        assert!(!previous.exists());
        assert!(extra.exists());
        assert_eq!(archives(&dir.path().join("family")).unwrap().len(), 2);
        fs::write(newest, b"corrupt").unwrap();
        assert_eq!(store.latest("family").unwrap().unwrap().path, extra);
    }
    #[test]
    fn quota_and_validation_failure_preserve_all_previous_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(dir.path(), 1024 * 1024);
        let good = store.autosave(&series()).unwrap();
        let named = store.save_revision(&series(), "reviewed").unwrap();
        let bytes = fs::read(&good).unwrap();
        let named_bytes = fs::read(&named).unwrap();
        let full = RecoveryStore::new(dir.path(), usage(dir.path()).unwrap());
        assert!(full.autosave(&series()).is_err());
        let mut bad = series();
        bad.episodes.clear();
        assert!(store.autosave(&bad).is_err());
        assert_eq!(fs::read(good).unwrap(), bytes);
        assert_eq!(fs::read(named).unwrap(), named_bytes);
    }
    #[test]
    fn unsafe_paths_and_cross_series_archives_are_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let store = RecoveryStore::new(dir.path(), 1024 * 1024);
        assert!(store.latest("../family").is_err());
        assert!(store.save_revision(&series(), "../name").is_err());
        let traversal = RecoveryStore::new(dir.path().join("../escape"), 1024 * 1024);
        assert!(traversal.autosave(&series()).is_err());
        let path = store.autosave(&series()).unwrap();
        let mut other = series();
        other.id = "another".into();
        save_atomic(&path, &other).unwrap();
        assert!(store.latest("family").unwrap().is_none());
    }
    #[cfg(unix)]
    #[test]
    fn symlink_cannot_redirect_recovery_into_user_directory() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("recovery");
        fs::create_dir(&root).unwrap();
        let user = dir.path().join("user");
        fs::create_dir(&user).unwrap();
        std::os::unix::fs::symlink(&user, root.join("family")).unwrap();
        let store = RecoveryStore::new(root, 1024 * 1024);
        assert!(store.autosave(&series()).is_err());
        assert_eq!(fs::read_dir(user).unwrap().count(), 0);
    }
}
