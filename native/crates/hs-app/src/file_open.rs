//! Bounded native file-open requests. Opening always goes through replacement UI.
use std::{
    collections::VecDeque,
    path::PathBuf,
    sync::{Arc, Mutex},
};
#[derive(Clone, Default)]
pub struct OpenRequests(Arc<Mutex<VecDeque<PathBuf>>>, Arc<Mutex<Option<String>>>);
impl OpenRequests {
    pub fn push(&self, path: PathBuf) -> Result<(), String> {
        if !path.is_absolute()
            || !path
                .extension()
                .is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case("koeta"))
            || path.as_os_str().len() > 4096
        {
            return Err("Finder-avaus vaatii paikallisen .koeta-tiedoston.".into());
        }
        let mut queue = self.0.lock().map_err(|_| "Tiedostonavausjono keskeytyi")?;
        if queue.contains(&path) {
            return Ok(());
        }
        if queue.len() >= 8 {
            return Err("Enintään kahdeksan tiedostonavausta kerrallaan.".into());
        }
        queue.push_back(path);
        Ok(())
    }
    #[cfg(target_os = "macos")]
    pub fn report(&self, error: String) {
        if let Ok(mut slot) = self.1.lock() {
            *slot = Some(error);
        }
    }
    pub fn take_error(&self) -> Option<String> {
        self.1.lock().ok()?.take()
    }
    pub fn pop(&self) -> Option<PathBuf> {
        self.0.lock().ok()?.pop_front()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn file_requests_preserve_order_reject_remote_and_bound_queue() {
        let queue = OpenRequests::default();
        assert!(queue.push("relative.koeta".into()).is_err());
        assert!(queue.push("/tmp/unrelated.txt".into()).is_err());
        for i in 0..8 {
            queue
                .push(PathBuf::from(format!("/tmp/project-{i}.koeta")))
                .unwrap();
        }
        queue.push("/tmp/project-0.koeta".into()).unwrap();
        assert!(queue.push("/tmp/extra.koeta".into()).is_err());
        assert_eq!(queue.pop().unwrap(), PathBuf::from("/tmp/project-0.koeta"));
    }
}
