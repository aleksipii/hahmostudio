//! Kameran kaappaus taustasäikeessä. Kuva ei lähde koneelta: jokainen ruutu
//! käsitellään muistissa ja vain pään asento sekä pieni esikatselu jäävät talteen.

use crate::{Blob, HeadPose, HeadTracker, Rgb};
use nokhwa::pixel_format::RgbFormat;
use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Pieni esikatselukuva ja seurattu alue sen koordinaateissa.
#[derive(Clone, Debug)]
pub struct Preview {
    pub image: Rgb,
    pub blob: Option<Blob>,
    pub frame: u64,
}

#[derive(Default)]
struct Shared {
    pose: Option<HeadPose>,
    preview: Option<Preview>,
    error: Option<String>,
    name: String,
    calibrated: bool,
    recalibrate: bool,
    gain: f32,
    smoothing: f32,
}

/// Käynnissä oleva kamera. Pudotus pysäyttää kaappauksen.
pub struct CameraFeed {
    shared: Arc<Mutex<Shared>>,
    stop: Arc<AtomicBool>,
}

impl CameraFeed {
    /// Avaa oletuskameran. macOS kysyy luvan ensimmäisellä kerralla.
    pub fn start(notify: Arc<dyn Fn() + Send + Sync>) -> CameraFeed {
        let shared = Arc::new(Mutex::new(Shared { gain: 1.0, smoothing: 0.6, ..Default::default() }));
        let stop = Arc::new(AtomicBool::new(false));
        let (s, st) = (shared.clone(), stop.clone());
        std::thread::spawn(move || {
            if let Err(e) = run(&s, &st, &*notify) {
                s.lock().unwrap().error = Some(e);
            }
            notify();
        });
        CameraFeed { shared, stop }
    }

    pub fn pose(&self) -> Option<HeadPose> {
        self.shared.lock().unwrap().pose
    }
    pub fn preview(&self) -> Option<Preview> {
        self.shared.lock().unwrap().preview.clone()
    }
    pub fn error(&self) -> Option<String> {
        self.shared.lock().unwrap().error.clone()
    }
    pub fn name(&self) -> String {
        self.shared.lock().unwrap().name.clone()
    }
    pub fn is_calibrated(&self) -> bool {
        self.shared.lock().unwrap().calibrated
    }
    pub fn recalibrate(&self) {
        self.shared.lock().unwrap().recalibrate = true;
    }
    pub fn set_tuning(&self, gain: f32, smoothing: f32) {
        let mut s = self.shared.lock().unwrap();
        s.gain = gain;
        s.smoothing = smoothing;
    }
}

impl Drop for CameraFeed {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}

fn run(shared: &Mutex<Shared>, stop: &AtomicBool, notify: &(dyn Fn() + Send + Sync)) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::channel();
    nokhwa::nokhwa_initialize(move |ok| {
        let _ = tx.send(ok);
    });
    match rx.recv_timeout(Duration::from_secs(60)) {
        Ok(true) => {}
        Ok(false) => return Err("Kameran käyttölupa evättiin. Salli se: Järjestelmäasetukset → Tietosuoja → Kamera.".into()),
        Err(_) => return Err("Kameran käyttölupaa ei saatu.".into()),
    }
    let format = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);
    let mut cam = nokhwa::Camera::new(CameraIndex::Index(0), format).map_err(|e| format!("Kameraa ei löytynyt: {e}"))?;
    cam.open_stream().map_err(|e| format!("Kameran avaus epäonnistui: {e}"))?;
    shared.lock().unwrap().name = cam.info().human_name();
    let mut tracker = HeadTracker::default();
    let mut frame = 0u64;
    while !stop.load(Ordering::Relaxed) {
        let buf = cam.frame().map_err(|e| format!("Kamerakuva puuttuu: {e}"))?;
        let img = buf.decode_image::<RgbFormat>().map_err(|e| format!("Kamerakuvan muunnos epäonnistui: {e}"))?;
        let rgb = Rgb { width: img.width(), height: img.height(), data: img.into_raw() };
        {
            let mut s = shared.lock().unwrap();
            if std::mem::take(&mut s.recalibrate) {
                tracker.recalibrate();
            }
            tracker.gain = s.gain;
            tracker.smoothing = s.smoothing;
        }
        let pose = tracker.track(&rgb);
        frame += 1;
        let preview = (frame & 1 == 0).then(|| Preview { image: rgb.downscaled(160), blob: tracker.last, frame });
        {
            let mut s = shared.lock().unwrap();
            s.pose = pose;
            s.calibrated = tracker.is_calibrated();
            if let Some(p) = preview {
                s.preview = Some(p);
            }
        }
        notify();
    }
    let _ = cam.stop_stream();
    Ok(())
}
