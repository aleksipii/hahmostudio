//! Kokoro-mallin paikallinen kansio.
//!
//! Malli ei koskaan ole sovelluspaketissa, repossa tai projektitiedostoissa.
//! Se ladataan kerran käyttäjän luvalla (tai kopioidaan käsin kansioon), minkä
//! jälkeen puhe toimii täysin ilman verkkoa. Jokainen tiedosto kirjataan
//! manifestiin koon ja SHA-256-tarkisteen kanssa (luotetaan ensimmäiseen
//! lataukseen), ja käynnistys varmistaa ne ennen mallin avaamista.

use crate::spoken::{MODEL_VERSION, VOICES};
use crate::VoiceError;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

pub const MODEL_LICENSE: &str = "Apache-2.0";
const WEIGHTS_REPO: &str = "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/";
const VOICES_REPO: &str = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/";

#[derive(Clone, Debug)]
pub struct ModelFile {
    pub path: String,
    pub url: String,
    pub max_bytes: u64,
}

/// Tarvittavat tiedostot: asetukset, painot ja studion äänet (510×256 f32 -tyylivektorit).
pub fn model_files() -> Vec<ModelFile> {
    let mut files = vec![
        ModelFile { path: "config.json".into(), url: format!("{WEIGHTS_REPO}config.json"), max_bytes: 2 << 20 },
        ModelFile { path: "kokoro-v1_0.pth".into(), url: format!("{WEIGHTS_REPO}kokoro-v1_0.pth"), max_bytes: 400 << 20 },
    ];
    for (voice, _) in VOICES {
        files.push(ModelFile { path: format!("voices/{voice}.bin"), url: format!("{VOICES_REPO}voices/{voice}.bin"), max_bytes: 1 << 20 });
    }
    files
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ManifestEntry {
    pub path: String,
    pub size: u64,
    pub sha256: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Manifest {
    pub schema_version: u32,
    pub model_version: String,
    pub license: String,
    pub files: Vec<ManifestEntry>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct StoreStatus {
    pub installed: bool,
    pub bytes: u64,
    pub error: Option<String>,
}

/// Installation mutations require one writer per store directory. The desktop
/// enforces this with its single model job; callers must not run import,
/// download or remove concurrently on the same directory. Failed replacements
/// roll back data and retain the old manifest. This is not a crash-recovery
/// journal: an interrupted process may leave a backup for manual recovery.
pub struct ModelStore {
    pub dir: PathBuf,
}

fn sha256_file(path: &Path) -> Result<String, VoiceError> {
    let mut hasher = Sha256::new();
    let mut f = std::fs::File::open(path)?;
    std::io::copy(&mut f, &mut hasher)?;
    Ok(hasher.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

/// Explicitly supplied complete PEM trust store for managed environments.
/// The desktop default remains ureq's verified Mozilla roots. A configured
/// bundle replaces those roots; it must include all public/private CAs needed.
/// Certificate verification is never disabled and a bad override is an error.
#[cfg(feature = "download")]
fn download_tls_config(bundle: Option<&Path>) -> Result<ureq::tls::TlsConfig, VoiceError> {
    use std::io::Read;
    use ureq::tls::{parse_pem, PemItem, RootCerts, TlsConfig};
    let Some(bundle) = bundle else { return Ok(TlsConfig::default()); };
    const MAX_CA_BYTES: u64 = 2 * 1024 * 1024;
    let mut bytes = Vec::new();
    let file = std::fs::File::open(bundle).map_err(|_| VoiceError::Model(
        "CA bundle cannot be opened. Check HAHMOSTUDIO_CA_BUNDLE or SSL_CERT_FILE; TLS verification remains enabled.".into()))?;
    file.take(MAX_CA_BYTES + 1).read_to_end(&mut bytes).map_err(|_| VoiceError::Model(
        "CA bundle cannot be read. Check HAHMOSTUDIO_CA_BUNDLE or SSL_CERT_FILE.".into()))?;
    if bytes.len() as u64 > MAX_CA_BYTES {
        return Err(VoiceError::Model("CA bundle exceeds the 2 MiB limit.".into()));
    }
    let mut certificates = Vec::new();
    for item in parse_pem(&bytes) {
        match item {
            Ok(PemItem::Certificate(certificate)) => certificates.push(certificate),
            Ok(_) => return Err(VoiceError::Model("CA bundle must contain public certificates, not private keys.".into())),
            Err(_) => return Err(VoiceError::Model("CA bundle contains malformed PEM certificates. TLS verification remains enabled.".into())),
        }
    }
    if certificates.is_empty() {
        return Err(VoiceError::Model("CA bundle contains no PEM certificates. Check HAHMOSTUDIO_CA_BUNDLE or SSL_CERT_FILE.".into()));
    }
    Ok(TlsConfig::builder().root_certs(RootCerts::from(certificates)).build())
}

#[cfg(feature = "download")]
fn download_agent() -> Result<ureq::Agent, VoiceError> {
    let bundle = std::env::var_os("HAHMOSTUDIO_CA_BUNDLE")
        .or_else(|| std::env::var_os("SSL_CERT_FILE")).map(PathBuf::from);
    let tls = download_tls_config(bundle.as_deref())?;
    Ok(ureq::Agent::config_builder().proxy(ureq::Proxy::try_from_env())
        .tls_config(tls).build().into())
}

impl ModelStore {
    /// `data_dir` on sovelluksen tietokansio; malli menee sen alikansioon `kokoro`.
    pub fn new(data_dir: impl AsRef<Path>) -> Self {
        ModelStore { dir: data_dir.as_ref().join("kokoro") }
    }

    /// Käyttöjärjestelmän mukainen oletuskansio (macOS: ~/Library/Application Support/hahmostudio).
    pub fn default_data_dir() -> Option<PathBuf> {
        if let Some(d) = std::env::var_os("HAHMOSTUDIO_DATA_DIR") {
            return Some(PathBuf::from(d));
        }
        let home = PathBuf::from(std::env::var_os("HOME")?);
        Some(if cfg!(target_os = "macos") {
            home.join("Library/Application Support/hahmostudio")
        } else {
            std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).unwrap_or_else(|| home.join(".local/share")).join("hahmostudio")
        })
    }

    pub fn model_dir(&self) -> PathBuf {
        self.dir.join("model")
    }

    fn manifest_path(&self) -> PathBuf {
        self.dir.join("manifest.json")
    }

    pub fn manifest(&self) -> Option<Manifest> {
        let m: Manifest = serde_json::from_slice(&std::fs::read(self.manifest_path()).ok()?).ok()?;
        (m.schema_version == 1 && m.model_version == MODEL_VERSION).then_some(m)
    }

    /// Asennettu vain, jos jokainen tiedosto löytyy ja vastaa manifestin kokoa
    /// (ja `verify`-tilassa tarkistetta).
    pub fn status(&self, verify: bool) -> StoreStatus {
        let missing = |e: &str| StoreStatus { installed: false, bytes: 0, error: Some(e.to_string()) };
        let Some(m) = self.manifest() else {
            return if self.manifest_path().exists() {
                missing("Mallimanifesti on virheellinen tai eri versiota. Tuo mallikansio uudelleen.")
            } else { StoreStatus { installed: false, bytes: 0, error: None } };
        };
        let mut bytes = 0;
        for f in model_files() {
            let Some(entry) = m.files.iter().find(|e| e.path == f.path) else { return missing("Mallitiedosto puuttuu manifestista.") };
            let path = self.model_dir().join(&f.path);
            match std::fs::metadata(&path) {
                Ok(md) if md.len() == entry.size && entry.size > 0 && entry.size <= f.max_bytes => bytes += md.len(),
                Ok(_) => return missing("Mallitiedoston koko ei täsmää."),
                Err(_) => return missing("Mallitiedosto puuttuu."),
            }
            if verify && sha256_file(&path).ok().as_deref() != Some(entry.sha256.as_str()) {
                return missing("Mallitiedoston tarkiste ei täsmää.");
            }
        }
        StoreStatus { installed: true, bytes, error: None }
    }

    fn write_manifest(&self, files: Vec<ManifestEntry>) -> Result<(), VoiceError> {
        let m = Manifest { schema_version: 1, model_version: MODEL_VERSION.into(), license: MODEL_LICENSE.into(), files };
        let tmp = self.manifest_path().with_extension("tmp");
        std::fs::write(&tmp, serde_json::to_vec_pretty(&m).unwrap())?;
        std::fs::rename(tmp, self.manifest_path())?;
        Ok(())
    }

    /// Ilman verkkoa: kopioi tiedostot kansiosta, jonka käyttäjä on ladannut itse
    /// (sama rakenne kuin [`model_files`]).
    pub fn import_from(&self, source: &Path) -> Result<StoreStatus, VoiceError> {
        self.import_from_cancelable(source, &std::sync::atomic::AtomicBool::new(false), &|_, _, _| {})
    }

    /// Copy and hash off the UI thread. Cancellation before commit preserves
    /// the previous installation; progress is per file, just like download.
    pub fn import_from_cancelable(
        &self, source: &Path, cancel: &std::sync::atomic::AtomicBool,
        progress: &dyn Fn(&str, u64, Option<u64>),
    ) -> Result<StoreStatus, VoiceError> {
        use std::io::{Read, Write};
        use std::sync::atomic::Ordering;
        if cancel.load(Ordering::Relaxed) { return Err(VoiceError::Cancelled); }
        let staging = self.dir.join(format!("staging-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&staging);
        let result = (|| {
            let mut entries = Vec::new();
            for f in model_files() {
                let from = source.join(&f.path);
                let size = std::fs::metadata(&from).map_err(|_| VoiceError::Model(format!("Tiedosto puuttuu: {}", f.path)))?.len();
                if size == 0 || size > f.max_bytes {
                    return Err(VoiceError::Model(format!("Mallitiedoston koko ei kelpaa: {}", f.path)));
                }
                let to = staging.join(&f.path);
                std::fs::create_dir_all(to.parent().unwrap())?;
                let mut input = std::fs::File::open(&from)?;
                let mut output = std::fs::File::create(&to)?;
                let mut hasher = Sha256::new();
                let mut buf = [0u8; 65536];
                let mut received = 0u64;
                loop {
                    if cancel.load(Ordering::Relaxed) { return Err(VoiceError::Cancelled); }
                    let n = input.read(&mut buf)?;
                    if n == 0 { break; }
                    received += n as u64;
                    if received > f.max_bytes { return Err(VoiceError::Model(format!("Mallitiedosto kasvoi tuonnin aikana: {}", f.path))); }
                    output.write_all(&buf[..n])?;
                    hasher.update(&buf[..n]);
                    progress(&f.path, received, Some(size));
                }
                if received != size { return Err(VoiceError::Model(format!("Mallitiedosto muuttui tuonnin aikana: {}", f.path))); }
                output.sync_all()?;
                entries.push(ManifestEntry { path: f.path.clone(), size, sha256: hasher.finalize().iter().map(|b| format!("{b:02x}")).collect() });
            }
            if cancel.load(Ordering::Relaxed) { return Err(VoiceError::Cancelled); }
            Ok(entries)
        })();
        self.commit(staging, result)
    }

    fn commit(&self, staging: PathBuf, entries: Result<Vec<ManifestEntry>, VoiceError>) -> Result<StoreStatus, VoiceError> {
        let entries = match entries {
            Ok(e) => e,
            Err(e) => {
                let _ = std::fs::remove_dir_all(&staging);
                return Err(e);
            }
        };
        // Keep the old model until both replacement data and manifest succeed.
        let backup = self.dir.join(format!("backup-{}", std::process::id()));
        if backup.exists() {
            let _ = std::fs::remove_dir_all(&staging);
            return Err(VoiceError::Model("Mallin palautuskansio on olemassa; säilytettiin nykyinen malli.".into()));
        }
        let had_model = self.model_dir().exists();
        if had_model { std::fs::rename(self.model_dir(), &backup)?; }
        let installed = std::fs::rename(&staging, self.model_dir()).and_then(|_| {
            self.write_manifest(entries).map_err(|e| std::io::Error::other(e.to_string()))
        });
        if let Err(e) = installed {
            let _ = std::fs::remove_dir_all(self.model_dir());
            let _ = std::fs::remove_dir_all(&staging);
            if had_model { std::fs::rename(&backup, self.model_dir())?; }
            return Err(e.into());
        }
        if had_model { let _ = std::fs::remove_dir_all(backup); }
        Ok(self.status(false))
    }

    /// Lataa mallin. Kutsutaan vasta, kun käyttäjä on hyväksynyt latauksen
    /// (koko ja lähde näytetään ennen). Peruutus jättää vanhan tilan ennalleen.
    #[cfg(feature = "download")]
    pub fn download(
        &self,
        cancel: &std::sync::atomic::AtomicBool,
        progress: &dyn Fn(&str, u64, Option<u64>),
    ) -> Result<StoreStatus, VoiceError> {
        use std::io::{Read, Write};
        use std::sync::atomic::Ordering;
        if cancel.load(Ordering::Relaxed) { return Err(VoiceError::Cancelled); }
        std::fs::create_dir_all(&self.dir)?;
        let staging = self.dir.join(format!("staging-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&staging);
        let agent = download_agent()?;
        let result = (|| {
            let mut entries = Vec::new();
            for f in model_files() {
                if cancel.load(Ordering::Relaxed) { return Err(VoiceError::Cancelled); }
                let target = staging.join(&f.path);
                std::fs::create_dir_all(target.parent().unwrap())?;
                let mut response =
                    agent.get(&f.url).call().map_err(|e| VoiceError::Model(format!("Mallin lataus epäonnistui ({}): {e}", f.path)))?;
                let total = response.body().content_length();
                if total.is_some_and(|t| t > f.max_bytes) {
                    return Err(VoiceError::Model(format!("Mallitiedosto on odotettua suurempi: {}", f.path)));
                }
                let mut reader = response.body_mut().with_config().limit(f.max_bytes).reader();
                let mut out = std::fs::File::create(&target)?;
                let mut hasher = Sha256::new();
                let mut buf = vec![0u8; 1 << 16];
                let mut received = 0u64;
                loop {
                    if cancel.load(Ordering::Relaxed) {
                        return Err(VoiceError::Cancelled);
                    }
                    let n = reader.read(&mut buf).map_err(|e| VoiceError::Model(format!("Mallin lataus katkesi ({}): {e}", f.path)))?;
                    if n == 0 {
                        break;
                    }
                    out.write_all(&buf[..n])?;
                    hasher.update(&buf[..n]);
                    received += n as u64;
                    progress(&f.path, received, total);
                }
                if received == 0 || total.is_some_and(|size| size != received) {
                    return Err(VoiceError::Model(format!("Mallitiedoston lataus jäi vajaaksi: {}", f.path)));
                }
                out.sync_all()?;
                entries.push(ManifestEntry {
                    path: f.path.clone(),
                    size: received,
                    sha256: hasher.finalize().iter().map(|b| format!("{b:02x}")).collect(),
                });
            }
            if cancel.load(Ordering::Relaxed) { return Err(VoiceError::Cancelled); }
            Ok(entries)
        })();
        self.commit(staging, result)
    }

    pub fn remove(&self) -> Result<StoreStatus, VoiceError> {
        if self.dir.exists() {
            std::fs::remove_dir_all(&self.dir)?;
        }
        Ok(self.status(false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(feature = "download")]
    #[test]
    fn ca_bundle_rejects_missing_empty_and_malformed_files() {
        let root = std::env::temp_dir().join(format!("hs-voice-ca-tests-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("bundle.pem");
        let _ = std::fs::remove_file(&path);
        assert!(download_tls_config(Some(&path)).is_err());
        for bytes in [b"".as_slice(), b"not a certificate".as_slice(),
            b"-----BEGIN CERTIFICATE-----\n!badbase64!\n-----END CERTIFICATE-----\n".as_slice()] {
            std::fs::write(&path, bytes).unwrap();
            assert!(download_tls_config(Some(&path)).is_err());
        }
        std::fs::write(&path, b"-----BEGIN PRIVATE KEY-----\nMAMCAQA=\n-----END PRIVATE KEY-----\n").unwrap();
        assert!(download_tls_config(Some(&path)).is_err());
        std::fs::write(&path, vec![b'x'; 2 * 1024 * 1024 + 1]).unwrap();
        assert!(download_tls_config(Some(&path)).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(feature = "download")]
    #[test]
    fn default_tls_verification_is_enabled_and_uses_public_roots() {
        let config = download_tls_config(None).unwrap();
        assert!(matches!(config.root_certs(), ureq::tls::RootCerts::WebPki));
        assert!(!config.disable_verification());
    }

    #[cfg(feature = "download")]
    #[test]
    fn injected_platform_bundle_loads_without_exposing_certificates() {
        let Some(path) = std::env::var_os("SSL_CERT_FILE") else {
            eprintln!("SKIP platform CA fixture: SSL_CERT_FILE is not injected");
            return;
        };
        let config = download_tls_config(Some(Path::new(&path))).unwrap();
        assert!(matches!(config.root_certs(), ureq::tls::RootCerts::Specific(certificates) if !certificates.is_empty()));
        assert!(!config.disable_verification());
    }

    fn fixture(name: &str) -> (PathBuf, PathBuf, ModelStore) {
        let root = std::env::temp_dir().join(format!("hs-voice-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let src = root.join("src");
        for f in model_files() {
            let p = src.join(&f.path);
            std::fs::create_dir_all(p.parent().unwrap()).unwrap();
            std::fs::write(p, f.path.as_bytes()).unwrap();
        }
        let store = ModelStore::new(root.join("data"));
        (root, src, store)
    }

    #[test]
    fn canceled_final_import_chunk_preserves_installed_model_and_manifest() {
        use std::sync::atomic::{AtomicBool, Ordering};
        let (root, src, store) = fixture("cancel-final");
        store.import_from(&src).unwrap();
        let manifest = std::fs::read(store.manifest_path()).unwrap();
        std::fs::write(src.join("config.json"), b"replacement").unwrap();
        let final_path = model_files().last().unwrap().path.clone();
        let cancel = AtomicBool::new(false);
        let result = store.import_from_cancelable(&src, &cancel, &|file, _, _| {
            if file == final_path { cancel.store(true, Ordering::Relaxed); }
        });
        assert!(matches!(result, Err(VoiceError::Cancelled)));
        assert_eq!(std::fs::read(store.manifest_path()).unwrap(), manifest);
        assert_eq!(std::fs::read(store.model_dir().join("config.json")).unwrap(), b"config.json");
        assert!(store.status(true).installed);
        assert!(!store.dir.join(format!("staging-{}", std::process::id())).exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn manifest_write_failure_rolls_back_old_model() {
        let (root, src, store) = fixture("rollback");
        store.import_from(&src).unwrap();
        let manifest = std::fs::read(store.manifest_path()).unwrap();
        std::fs::write(src.join("config.json"), b"replacement").unwrap();
        // Force the temporary manifest write to fail after data installation.
        std::fs::create_dir(store.manifest_path().with_extension("tmp")).unwrap();
        assert!(store.import_from(&src).is_err());
        assert_eq!(std::fs::read(store.manifest_path()).unwrap(), manifest);
        assert_eq!(std::fs::read(store.model_dir().join("config.json")).unwrap(), b"config.json");
        assert!(store.status(true).installed);
        assert!(!store.dir.join(format!("backup-{}", std::process::id())).exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(feature = "download")]
    #[test]
    fn canceled_download_does_not_contact_network_or_replace_model() {
        let (root, src, store) = fixture("cancel-download");
        store.import_from(&src).unwrap();
        let manifest = std::fs::read(store.manifest_path()).unwrap();
        let result = store.download(&std::sync::atomic::AtomicBool::new(true), &|_, _, _| panic!("no progress after pre-cancel"));
        assert!(matches!(result, Err(VoiceError::Cancelled)));
        assert_eq!(std::fs::read(store.manifest_path()).unwrap(), manifest);
        assert!(store.status(true).installed);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn malformed_manifest_reports_repair_instead_of_missing_installation() {
        let (root, src, store) = fixture("malformed-manifest");
        store.import_from(&src).unwrap();
        std::fs::write(store.manifest_path(), b"broken JSON").unwrap();
        let status = store.status(false);
        assert!(!status.installed);
        assert!(status.error.unwrap().contains("manifesti"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn empty_model_file_is_not_an_installation() {
        let (root, src, store) = fixture("empty-file");
        store.import_from(&src).unwrap();
        let manifest = std::fs::read(store.manifest_path()).unwrap();
        std::fs::write(src.join("config.json"), b"").unwrap();
        assert!(store.import_from(&src).is_err());
        assert_eq!(std::fs::read(store.manifest_path()).unwrap(), manifest);
        assert!(store.status(true).installed);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn import_verifies_and_detects_tampering() {
        let root = std::env::temp_dir().join(format!("hs-voice-store-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let src = root.join("src");
        for f in model_files() {
            let p = src.join(&f.path);
            std::fs::create_dir_all(p.parent().unwrap()).unwrap();
            std::fs::write(p, f.path.as_bytes()).unwrap();
        }
        let store = ModelStore::new(root.join("data"));
        assert!(!store.status(false).installed);
        let st = store.import_from(&src).unwrap();
        assert!(st.installed, "{st:?}");
        assert!(store.status(true).installed);
        // Sama koko, eri sisältö: vain tarkiste paljastaa.
        let cfg = store.model_dir().join("config.json");
        let mut bytes = std::fs::read(&cfg).unwrap();
        bytes[0] ^= 1;
        std::fs::write(&cfg, bytes).unwrap();
        assert!(store.status(false).installed);
        assert!(!store.status(true).installed);
        // Puuttuva tiedosto lähteessä ei koske asennettuun malliin.
        std::fs::remove_file(src.join("config.json")).unwrap();
        assert!(store.import_from(&src).is_err());
        assert!(store.model_dir().join("kokoro-v1_0.pth").exists());
        store.remove().unwrap();
        assert!(!store.status(false).installed);
        let _ = std::fs::remove_dir_all(&root);
    }
}
