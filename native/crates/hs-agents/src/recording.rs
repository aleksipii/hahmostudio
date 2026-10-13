//! Metadata for user recordings, independent of synthesized speech cache keys.
//! Edited dialogue never silently rebinds an earlier recording to new words.
//! Unknown legacy orphans remain preserved but are not assigned guessed speakers.
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};

pub const MAX_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_RECORDINGS: usize = 4096;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RecordedLine {
    pub speaker: Option<String>,
    pub text: String,
}
pub type RecordedLines = HashMap<String, RecordedLine>;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Packet {
    version: u32,
    #[serde(deserialize_with = "deserialize_records")]
    records: BTreeMap<String, RecordedLine>,
}
fn valid_record(key: &str, line: &RecordedLine) -> bool {
    !key.is_empty()
        && key.len() <= 512
        && line.text.len() <= 4096
        && match &line.speaker {
            None => true,
            Some(speaker) => speaker.len() <= 256,
        }
}
fn deserialize_records<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<BTreeMap<String, RecordedLine>, D::Error> {
    struct Records;
    impl<'de> serde::de::Visitor<'de> for Records {
        type Value = BTreeMap<String, RecordedLine>;
        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a bounded map of unique recording metadata keys")
        }
        fn visit_map<M: serde::de::MapAccess<'de>>(
            self,
            mut map: M,
        ) -> Result<Self::Value, M::Error> {
            let mut records = BTreeMap::new();
            while let Some((key, line)) = map.next_entry::<String, RecordedLine>()? {
                if records.len() >= MAX_RECORDINGS
                    || !valid_record(&key, &line)
                    || records.insert(key, line).is_some()
                {
                    return Err(serde::de::Error::custom(
                        "invalid, duplicate or excessive recording metadata",
                    ));
                }
            }
            Ok(records)
        }
    }
    deserializer.deserialize_map(Records)
}

/// Serialize metadata only, never PCM samples. All own audio remains separate.
pub fn encode(recorded: &RecordedLines) -> Result<Vec<u8>, String> {
    if recorded.len() > MAX_RECORDINGS {
        return Err("Too many recordings".into());
    }
    let mut size = 0usize;
    for (key, line) in recorded {
        if !valid_record(key, line) {
            return Err("Invalid recording metadata bounds".into());
        }
        size = size
            .saturating_add(key.len())
            .saturating_add(line.text.len())
            .saturating_add(line.speaker.as_ref().map_or(0, |s| s.len()));
    }
    if size > MAX_BYTES {
        return Err("Recording metadata exceeds 8 MiB".into());
    }
    let bytes = serde_json::to_vec(&Packet {
        version: 1,
        records: recorded
            .iter()
            .map(|(key, line)| (key.clone(), line.clone()))
            .collect(),
    })
    .map_err(|e| e.to_string())?;
    if bytes.len() > MAX_BYTES {
        return Err("Recording metadata exceeds 8 MiB".into());
    }
    Ok(bytes)
}

pub fn decode(bytes: &[u8]) -> Result<RecordedLines, String> {
    if bytes.len() > MAX_BYTES {
        return Err("Recording metadata exceeds 8 MiB".into());
    }
    let packet: Packet = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    if packet.version != 1 {
        return Err("Unsupported recording metadata version".into());
    }
    Ok(packet.records.into_iter().collect())
}

/// Conservative review guard: a missing recorded line from the same speaker may
/// have been edited. Do not substitute synthesized speech until reviewed. The
/// original recording is retained as an orphan, never relabeled as new words.
/// Adding another line while the original remains in the script needs no review.
pub fn needs_review(
    new_speaker: &Option<String>,
    new_key: &str,
    current_keys: &HashSet<String>,
    own_keys: &HashSet<String>,
    recorded: &RecordedLines,
) -> bool {
    if own_keys.contains(new_key) {
        return false;
    }
    recorded.iter().any(|(key, line)| {
        own_keys.contains(key) && !current_keys.contains(key) && line.speaker == *new_speaker
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> RecordedLines {
        HashMap::from([(
            "original-key".into(),
            RecordedLine {
                speaker: Some("Kalle".into()),
                text: "Hello there!".into(),
            },
        )])
    }
    #[test]
    fn edited_text_requires_review_but_added_line_does_not() {
        let recorded = fixture();
        let own = HashSet::from(["original-key".into()]);
        let added = HashSet::from(["original-key".into(), "new-key".into()]);
        assert!(!needs_review(
            &Some("Kalle".into()),
            "new-key",
            &added,
            &own,
            &recorded
        ));
        let edited = HashSet::from(["new-key".into()]);
        assert!(needs_review(
            &Some("Kalle".into()),
            "new-key",
            &edited,
            &own,
            &recorded
        ));
        assert!(!needs_review(
            &Some("Maija".into()),
            "new-key",
            &edited,
            &own,
            &recorded
        ));
        assert!(!needs_review(
            &Some("Kalle".into()),
            "new-key",
            &edited,
            &HashSet::new(),
            &recorded
        ));
    }
    #[test]
    fn own_same_key_wins_and_legacy_orphans_are_not_guessed() {
        let recorded = fixture();
        let current = HashSet::from(["new-key".into()]);
        let own = HashSet::from(["original-key".into(), "new-key".into()]);
        assert!(!needs_review(
            &Some("Kalle".into()),
            "new-key",
            &current,
            &own,
            &recorded
        ));
        assert!(!needs_review(
            &Some("Kalle".into()),
            "new-key",
            &current,
            &HashSet::from(["legacy-key".into()]),
            &recorded
        ));
        assert!(!needs_review(
            &Some("Kalle".into()),
            "new-key",
            &current,
            &own,
            &HashMap::new()
        ));
    }
    #[test]
    fn deterministic_roundtrip_and_exact_original_text() {
        let mut recorded = fixture();
        recorded.insert(
            "narrator".into(),
            RecordedLine {
                speaker: None,
                text: "Hi, café!\nNext line".into(),
            },
        );
        let bytes = encode(&recorded).unwrap();
        assert_eq!(decode(&bytes).unwrap(), recorded);
        assert_eq!(encode(&decode(&bytes).unwrap()).unwrap(), bytes);
    }
    #[test]
    fn rejects_invalid_versions_duplicates_and_bounds() {
        assert!(decode(br#"{"version":2,"records":{}}"#).is_err());
        assert!(decode(br#"{"version":1,"records":{"a":{"speaker":null,"text":"first"},"a":{"speaker":null,"text":"second"}}}"#).is_err());
        for case in 0..4 {
            let mut records = fixture();
            let mut line = records.remove("original-key").unwrap();
            let key = match case {
                0 => "x".repeat(513),
                1 => String::new(),
                _ => "valid".into(),
            };
            if case == 2 {
                line.text = "x".repeat(4097);
            }
            if case == 3 {
                line.speaker = Some("x".repeat(257));
            }
            records.insert(key, line);
            assert!(encode(&records).is_err());
            let bytes =
                serde_json::to_vec(&serde_json::json!({"version":1,"records":records})).unwrap();
            assert!(decode(&bytes).is_err());
        }
        let records = (0..MAX_RECORDINGS + 1)
            .map(|i| {
                (
                    i.to_string(),
                    RecordedLine {
                        speaker: None,
                        text: "".into(),
                    },
                )
            })
            .collect();
        assert!(encode(&records).is_err());
        let too_many =
            serde_json::to_vec(&serde_json::json!({"version":1,"records":records})).unwrap();
        assert!(decode(&too_many).is_err());
        assert!(decode(&vec![b' '; MAX_BYTES + 1]).is_err());
        let oversized = (0..2049)
            .map(|i| {
                (
                    i.to_string(),
                    RecordedLine {
                        speaker: None,
                        text: "x".repeat(4096),
                    },
                )
            })
            .collect();
        assert!(encode(&oversized).is_err());
    }
}
