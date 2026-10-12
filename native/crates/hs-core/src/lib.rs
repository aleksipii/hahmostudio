//! Hahmostudion natiivi ydin.
//!
//! Tämä kerros ei riipu käyttöliittymästä, GPU:sta eikä käyttöjärjestelmästä
//! (Storytold/FilmCraft-tyylinen kerrosjako). Kaikki muut kerrokset käyttävät
//! samaa kokonaislukuista aikapohjaa ([`Tick`]) ja samoja lähdetunnisteita.

pub mod diagnostics;
pub mod time;
pub mod timeline;

pub use diagnostics::{Diagnostic, Severity};
pub use time::{Fps, Tick, TICKS_PER_SECOND};
pub use timeline::{
    CameraHint, Direction, EventId, EventKind, MotionKind, PhoneView, SourceSpan, Timeline,
    TimelineEvent, TrackKind, View,
};
