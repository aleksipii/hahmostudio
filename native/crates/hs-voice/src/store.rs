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
        let Some(m) = self.manifest() else { return StoreStatus { installed: false, bytes: 0, error: None } };
        let mut bytes = 0;
        for f in model_files() {
            let Some(entry) = m.files.iter().find(|e| e.path == f.path) else { return missing("Mallitiedosto puuttuu manifestista.") };
            let path = self.model_dir().join(&f.path);
            match std::fs::metadata(&path) {
                Ok(md) if md.len() == entry.size => bytes += md.len(),
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
        let staging = self.dir.join(format!("staging-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&staging);
        let result = (|| {
            let mut entries = Vec::new();
            for f in model_files() {
                let from = source.join(&f.path);
                let size = std::fs::metadata(&from).map_err(|_| VoiceError::Model(format!("Tiedosto puuttuu: {}", f.path)))?.len();
                if size > f.max_bytes {
                    return Err(VoiceError::Model(format!("Mallitiedosto on odotettua suurempi: {}", f.path)));
                }
                let to = staging.join(&f.path);
                std::fs::create_dir_all(to.parent().unwrap())?;
                std::fs::copy(&from, &to)?;
                entries.push(ManifestEntry { path: f.path.clone(), size, sha256: sha256_file(&to)? });
            }
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
        let _ = std::fs::remove_dir_all(self.model_dir());
        std::fs::rename(&staging, self.model_dir())?;
        self.write_manifest(entries)?;
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
        std::fs::create_dir_all(&self.dir)?;
        let staging = self.dir.join(format!("staging-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&staging);
        let agent = download_agent()?;
        let result = (|| {
            let mut entries = Vec::new();
            for f in model_files() {
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
                out.sync_all()?;
                entries.push(ManifestEntry {
                    path: f.path.clone(),
                    size: received,
                    sha256: hasher.finalize().iter().map(|b| format!("{b:02x}")).collect(),
                });
            }
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
