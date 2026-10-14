//! Sample-clock adapter for externally verified alignment or authored corrections.
//!
//! This does not recognize phonemes or extract Kokoro durations. Callers supply
//! their alignment as viseme spans against the exact, final mono waveform.
//! Unlike the heuristic builders, it never redistributes or minimum-hold-merges
//! spans: short lip closures and silent gaps retain their authored boundaries.
use crate::{analyze, envelope, Audio, Viseme, VisemeKey, VisemeTrack};
use serde::{Deserialize, Serialize};
use std::{error::Error, fmt};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AlignedViseme {
    /// Inclusive start on the final waveform's sample clock.
    pub start_sample: u64,
    /// Exclusive end on the same clock.
    pub end_sample: u64,
    pub viseme: Viseme,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AlignmentError {
    InvalidSampleRate,
    AudioTooLong,
    NonFiniteSample { index: usize },
    TooManySpans,
    TimeResolution { index: usize },
    InvalidSpan { index: usize },
    OverlapOrUnsorted { index: usize },
}
impl fmt::Display for AlignmentError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidSampleRate => write!(f, "Alignment needs an 8–192 kHz sample rate"),
            Self::AudioTooLong => write!(f, "Alignment audio exceeds 10 minutes"),
            Self::NonFiniteSample { index } => write!(f, "Non-finite audio sample at {index}"),
            Self::TimeResolution { index } => {
                write!(f, "Alignment span {index} exceeds track time precision")
            }
            Self::TooManySpans => write!(f, "Alignment exceeds 100000 spans"),
            Self::InvalidSpan { index } => {
                write!(f, "Alignment span {index} is empty or outside the audio")
            }
            Self::OverlapOrUnsorted { index } => {
                write!(f, "Alignment span {index} overlaps or is out of order")
            }
        }
    }
}
impl Error for AlignmentError {}

/// Create a legacy-compatible track with exact event boundaries and an envelope
/// derived from the supplied waveform. Existing `shape_at` performs its regular
/// visual crossfade; exact event lookup uses `viseme_at`. Very short events can
/// need a separately tuned visual interpolation policy on a production rig.
///
/// No sort, clamping, unknown-label substitution or timing guess is performed.
/// Empty spans describe a silent/rest track. Inputs are fully validated before
/// waveform analysis; callers should also bind audio+alignment by content hash.
pub fn from_aligned(audio: &Audio, spans: &[AlignedViseme]) -> Result<VisemeTrack, AlignmentError> {
    if !(8000..=192000).contains(&audio.sample_rate) {
        return Err(AlignmentError::InvalidSampleRate);
    }
    let count = audio.samples.len() as u64;
    if count > u64::from(audio.sample_rate) * 600 {
        return Err(AlignmentError::AudioTooLong);
    }
    if spans.len() > 100_000 {
        return Err(AlignmentError::TooManySpans);
    }
    let mut end = 0;
    let mut previous_time = 0.0f32;
    for (index, span) in spans.iter().enumerate() {
        if span.start_sample >= span.end_sample || span.end_sample > count {
            return Err(AlignmentError::InvalidSpan { index });
        }
        if span.start_sample < end {
            return Err(AlignmentError::OverlapOrUnsorted { index });
        }
        let start_time = (span.start_sample as f64 / f64::from(audio.sample_rate)) as f32;
        let end_time = (span.end_sample as f64 / f64::from(audio.sample_rate)) as f32;
        if end_time <= start_time || (span.start_sample > end && start_time <= previous_time) {
            return Err(AlignmentError::TimeResolution { index });
        }
        end = span.end_sample;
        previous_time = end_time;
    }
    if let Some(index) = audio.samples.iter().position(|sample| !sample.is_finite()) {
        return Err(AlignmentError::NonFiniteSample { index });
    }
    let mut keys: Vec<VisemeKey> = Vec::with_capacity(spans.len() * 2 + 1);
    let mut push = |sample: u64, viseme: Viseme| {
        let t = (sample as f64 / f64::from(audio.sample_rate)) as f32;
        if let Some(last) = keys.last_mut() {
            if last.t == t {
                last.viseme = viseme;
                return;
            }
            if last.viseme == viseme {
                return;
            }
        }
        keys.push(VisemeKey { t, viseme });
    };
    push(0, Viseme::Rest);
    for span in spans {
        push(span.start_sample, span.viseme);
        push(span.end_sample, Viseme::Rest);
    }
    Ok(VisemeTrack {
        keys,
        envelope: envelope(&analyze(audio)),
        duration: audio.duration(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn audio(rate: u32) -> Audio {
        Audio {
            sample_rate: rate,
            samples: vec![0.1; rate as usize],
        }
    }

    #[test]
    fn short_closure_adjacent_vowel_and_silent_gap_keep_exact_event_timing() {
        for rate in [8000, 24000, 44100, 48000, 192000] {
            let ms = |n: u64| u64::from(rate) * n / 1000;
            let spans = [
                AlignedViseme {
                    start_sample: ms(100),
                    end_sample: ms(120),
                    viseme: Viseme::Mbp,
                },
                AlignedViseme {
                    start_sample: ms(120),
                    end_sample: ms(250),
                    viseme: Viseme::Ah,
                },
                AlignedViseme {
                    start_sample: ms(600),
                    end_sample: ms(900),
                    viseme: Viseme::Fv,
                },
            ];
            let track = from_aligned(&audio(rate), &spans).unwrap();
            for (time, expected) in [
                (0.0, Viseme::Rest),
                (0.11, Viseme::Mbp),
                (0.14, Viseme::Ah),
                (0.4, Viseme::Rest),
                (0.7, Viseme::Fv),
                (1.0, Viseme::Rest),
            ] {
                assert_eq!(track.viseme_at(time), expected, "rate={rate}, time={time}");
            }
            assert_eq!(track.keys.iter().filter(|key| key.t == 0.12).count(), 1);
            assert!(track.keys.windows(2).all(|pair| pair[0].t < pair[1].t));
            assert_eq!(track, from_aligned(&audio(rate), &spans).unwrap());
        }
    }

    #[test]
    fn invalid_alignment_is_rejected_without_sorting_or_clamping() {
        let a = audio(24000);
        let span = |start, end| AlignedViseme {
            start_sample: start,
            end_sample: end,
            viseme: Viseme::Mbp,
        };
        for s in [span(50, 50), span(60, 10), span(0, 24001)] {
            assert_eq!(
                from_aligned(&a, &[s]),
                Err(AlignmentError::InvalidSpan { index: 0 })
            );
        }
        for spans in [
            [span(10, 100), span(90, 200)],
            [span(100, 200), span(10, 50)],
        ] {
            assert_eq!(
                from_aligned(&a, &spans),
                Err(AlignmentError::OverlapOrUnsorted { index: 1 })
            );
        }
        assert_eq!(
            from_aligned(&Audio::default(), &[]),
            Err(AlignmentError::InvalidSampleRate)
        );
        let mut a = a;
        a.samples[42] = f32::NAN;
        assert_eq!(
            from_aligned(&a, &[]),
            Err(AlignmentError::NonFiniteSample { index: 42 })
        );
    }

    #[test]
    fn empty_and_silent_takes_remain_rest_and_seek_is_order_independent() {
        let empty = Audio {
            sample_rate: 24000,
            samples: vec![],
        };
        let track = from_aligned(&empty, &[]).unwrap();
        assert_eq!(track.duration, 0.0);
        assert_eq!(track.shape_at(0.0), Viseme::Rest.shape());
        let silent = Audio {
            sample_rate: 24000,
            samples: vec![0.0; 24000],
        };
        let track = from_aligned(&silent, &[]).unwrap();
        for t in [0.8, 0.1, 1.0, 0.5] {
            assert_eq!(track.shape_at(t), Viseme::Rest.shape());
        }
    }
}
