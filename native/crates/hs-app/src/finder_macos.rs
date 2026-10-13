//! Cocoa file-open bridge. Installed after winit creates NSApplication.
use crate::file_open::OpenRequests;
use objc2::{define_class, msg_send, DefinedClass, MainThreadOnly};
use objc2::{rc::Retained, runtime::ProtocolObject};
use objc2_app_kit::{NSApplication, NSApplicationDelegate};
use objc2_foundation::{MainThreadMarker, NSArray, NSObject, NSObjectProtocol, NSString, NSURL};
use std::{ffi::CStr, os::unix::ffi::OsStrExt, path::PathBuf};
pub struct Ivars {
    requests: OpenRequests,
    notify: Box<dyn Fn()>,
}

define_class!(
    // NSObject has no extra subclassing requirements; this class stays on main thread.
    #[unsafe(super = NSObject)]
    #[thread_kind = MainThreadOnly]
    #[ivars = Ivars]
    #[name = "KoetaFinderFileDelegate"]
    pub struct FinderDelegate;
    unsafe impl NSObjectProtocol for FinderDelegate {}
    unsafe impl NSApplicationDelegate for FinderDelegate {
        #[unsafe(method(application:openURLs:))]
        fn open_urls(&self, _app: &NSApplication, urls: &NSArray<NSURL>) {
            if urls.count() > 8 {
                self.ivars().requests.report(
                    "Finder lähetti yli kahdeksan projektia; ensimmäiset kahdeksan käsitellään."
                        .into(),
                );
                (self.ivars().notify)();
            }
            for index in 0..urls.count().min(8) {
                let url = urls.objectAtIndex(index);
                if url.isFileURL() {
                    // Cocoa owns a valid, terminated file-system representation while URL lives.
                    let bytes = unsafe { CStr::from_ptr(url.fileSystemRepresentation().as_ptr()) }
                        .to_bytes();
                    self.enqueue(PathBuf::from(std::ffi::OsStr::from_bytes(bytes)));
                }
            }
        }
        #[unsafe(method(application:openFile:))]
        fn open_file(&self, _app: &NSApplication, file: &NSString) -> bool {
            self.enqueue(PathBuf::from(file.to_string()))
        }
        #[unsafe(method(application:openFiles:))]
        fn open_files(&self, _app: &NSApplication, files: &NSArray<NSString>) {
            if files.count() > 8 {
                self.ivars().requests.report(
                    "Finder lähetti yli kahdeksan projektia; ensimmäiset kahdeksan käsitellään."
                        .into(),
                );
                (self.ivars().notify)();
            }
            for index in 0..files.count().min(8) {
                self.enqueue(PathBuf::from(files.objectAtIndex(index).to_string()));
            }
        }
    }
);
impl FinderDelegate {
    fn enqueue(&self, path: PathBuf) -> bool {
        let accepted = match self.ivars().requests.push(path) {
            Ok(()) => true,
            Err(e) => {
                self.ivars().requests.report(e);
                false
            }
        };
        (self.ivars().notify)();
        accepted
    }
}
pub fn install(
    requests: OpenRequests,
    notify: Box<dyn Fn()>,
) -> Result<Retained<FinderDelegate>, String> {
    let mtm = MainThreadMarker::new().ok_or("Finder-delegaatti vaatii pääsäikeen")?;
    let app = NSApplication::sharedApplication(mtm);
    if app.delegate().is_some() {
        return Err("Olemassa olevaa sovellusdelegaattia ei korvata.".into());
    }
    let allocated = FinderDelegate::alloc(mtm).set_ivars(Ivars { requests, notify });
    // NSObject init initializes the already allocated subclass and its Rust ivars.
    let delegate: Retained<FinderDelegate> = unsafe { msg_send![super(allocated), init] };
    app.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
    Ok(delegate)
}
