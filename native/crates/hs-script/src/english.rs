//! Bounded English instruction grammar for the existing rendered domain.
//! No dialogue understanding: callers must offer an explicit instruction.

use crate::{BACKGROUND_ALIASES, MAX_LINE_SECONDS, MIN_LINE_SECONDS, PROP_ALIASES};

#[derive(Clone, Copy, Debug)]
pub struct CommandExample {
    pub example: &'static str,
    pub description: &'static str,
}

pub const COMMANDS: &[CommandExample] = &[
    CommandExample { example: "sit on chair 2s", description: "Sit on the actor-associated chair and remain seated" },
    CommandExample { example: "stand up 2s", description: "Rise from the actor-associated chair" },
    CommandExample {
        example: "walk to the left for 2 seconds",
        description: "Walk left for an explicit duration",
    },
    CommandExample {
        example: "running right 3s",
        description: "Run right",
    },
    CommandExample {
        example: "walk straight ahead 2s",
        description: "Walk toward the front",
    },
    CommandExample {
        example: "wave hello 2s",
        description: "Wave a hand",
    },
    CommandExample {
        example: "jump 1.2s",
        description: "Jump",
    },
    CommandExample {
        example: "crouching 2s",
        description: "Crouch",
    },
    CommandExample {
        example: "nodding 2s",
        description: "Nod",
    },
    CommandExample {
        example: "wait for 2 seconds",
        description: "Pause",
    },
    CommandExample {
        example: "texting on phone 3s",
        description: "Tap the phone",
    },
    CommandExample {
        example: "background living room",
        description: "Use an existing scene background",
    },
    CommandExample {
        example: "prop coffee cup",
        description: "Hold an existing prop",
    },
    CommandExample {
        example: "camera close up",
        description: "Set an authored camera shot",
    },
    CommandExample {
        example: "emotion cheerful",
        description: "Set an explicit happy expression",
    },
    CommandExample {
        example: "look toward camera",
        description: "Look at the camera",
    },
];

fn error(tag: &str) -> String {
    format!("Unsupported or ambiguous English instruction: [{tag}]. Use an exact supported command and direction.")
}

/// Returns a supported canonical tag, an error for a recognized but invalid
/// English command, or `None` for an unrelated tag (including Finnish tags).
/// Output is accepted by the canonical parser without calling this recursively.
pub fn normalize_tag(tag: &str) -> Result<Option<String>, String> {
    let normalized = tag
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase();
    let normalized = normalized.replace('’', "'");
    let Some(first) = normalized.split_whitespace().next() else {
        return Ok(None);
    };
    if matches!(first, "don't" | "dont" | "never" | "not" | "no")
        || normalized.starts_with("do not ")
    {
        return Err(error(tag));
    }
    match first.trim_end_matches(':') {
        "expression" | "emotion" => {
            let rest = normalized[first.len()..].trim_start_matches(':').trim();
            let expression = match rest {
                "neutral" | "calm" => "neutral",
                "happy" | "cheerful" | "joyful" => "happy",
                "angry" | "mad" => "angry",
                "sad" | "unhappy" => "sad",
                "surprised" | "astonished" => "surprised",
                "scared" | "afraid" | "frightened" => "scared",
                _ => return Err(error(tag)),
            };
            return Ok(Some(format!("expression {expression}")));
        }
        "shot" | "camera" => {
            let rest = normalized[first.len()..].trim_start_matches(':').trim();
            let shot = match rest {
                "wide" | "wide shot" | "full shot" => "wide",
                "medium" | "medium shot" => "medium",
                "close" | "closeup" | "close-up" | "close up" | "close-up shot" => "close-up",
                "insert" | "insert shot" => "insert",
                "two-shot" | "twoshot" | "two shot" => "two-shot",
                "over-shoulder" | "over shoulder" | "over the shoulder" | "ots" => "over-shoulder",
                "low" | "low-angle" | "low angle" => "low-angle",
                "high" | "high-angle" | "high angle" => "high-angle",
                _ => return Err(error(tag)),
            };
            return Ok(Some(format!("shot {shot}")));
        }
        "look" => {
            let rest = normalized
                .strip_prefix("look at ")
                .or_else(|| normalized.strip_prefix("look toward "))
                .or_else(|| normalized.strip_prefix("look towards "))
                .ok_or_else(|| error(tag))?;
            if rest == "camera" || rest == "the camera" {
                return Ok(Some("look at camera".into()));
            }
            if rest.chars().count() > 32
                || !rest.chars().next().is_some_and(char::is_alphabetic)
                || !rest
                    .chars()
                    .all(|c| c.is_alphanumeric() || c == '-' || c == '.')
            {
                return Err(error(tag));
            }
            return Ok(Some(format!("look at {rest}")));
        }
        "background" => {
            let rest = normalized[first.len()..].trim_start_matches(':').trim();
            if BACKGROUND_ALIASES.iter().any(|(alias, _)| *alias == rest) {
                return Ok(Some(format!("background {rest}")));
            }
            return Err(error(tag));
        }
        "prop" => {
            let rest = normalized[first.len()..].trim_start_matches(':').trim();
            if matches!(rest, "none" | "away" | "hidden") {
                return Ok(Some("prop none".into()));
            }
            if PROP_ALIASES.iter().any(|(alias, _)| *alias == rest)
                || matches!(
                    rest,
                    "phone front"
                        | "phone back"
                        | "phone side"
                        | "phone hidden"
                        | "phone none"
                        | "phone away"
                )
            {
                return Ok(Some(format!("prop {rest}")));
            }
            return Err(error(tag));
        }
        "view" => {
            let rest = normalized[first.len()..].trim_start_matches(':').trim();
            if matches!(rest, "front" | "left" | "right" | "back") {
                return Ok(Some(format!("view {rest}")));
            }
            return Err(error(tag));
        }
        "phone" => {
            let rest = normalized[first.len()..].trim();
            if matches!(rest, "front" | "back" | "side" | "hidden" | "none" | "away") {
                return Ok(Some(format!("prop phone {rest}")));
            }
            return Err(error(tag));
        }
        _ => {}
    }
    let action = match first {
        "walk" | "walking" => "kävele",
        "run" | "running" => "juokse",
        "wave" | "waving" => "vilkuta",
        "jump" | "jumping" => "hyppää",
        "crouch" | "crouching" => "kyykisty",
        "nod" | "nodding" => "nyökkää",
        "wait" | "waiting" | "pause" | "pausing" => "odota",
        "text" | "texting" | "tap" | "tapping" | "type" | "typing" => "näpyttele puhelinta",
        "sit" | "sitting" => "istu tuolille",
        "stand" | "standing" => "nouse tuolilta",
        // Recognized English commands outside the rendered domain stay errors.
        "open" | "close" | "fly" | "dance" | "turn" => {
            return Err(error(tag))
        }
        _ => return Ok(None),
    };
    let rest = normalized[first.len()..].trim();
    let (rest, duration) = take_duration(rest, tag)?;
    let direction = match action {
        "kävele" | "juokse" => match rest.as_str() {
            "left" | "to the left" | "to left" | "toward left" | "towards left" => " vasemmalle",
            "right" | "to the right" | "to right" | "toward right" | "towards right" => " oikealle",
            "front" | "forward" | "forwards" | "straight ahead" | "to the front" => " suoraan",
            // Direction is required; never silently choose right or a target.
            _ => return Err(error(tag)),
        },
        "istu tuolille" => {
            if !matches!(rest.as_str(), "on chair" | "on the chair") { return Err(error(tag)); }
            ""
        },
        "nouse tuolilta" => {
            if rest != "up" { return Err(error(tag)); }
            ""
        },
        "vilkuta" => {
            if !matches!(rest.as_str(), "" | "hello" | "goodbye") {
                return Err(error(tag));
            }
            ""
        }
        "näpyttele puhelinta" => {
            let accepted = match first {
                "text" | "texting" => matches!(rest.as_str(), "" | "on phone" | "on the phone"),
                "tap" | "tapping" => matches!(rest.as_str(), "phone" | "the phone"),
                "type" | "typing" => matches!(rest.as_str(), "on phone" | "on the phone"),
                _ => false,
            };
            if !accepted {
                return Err(error(tag));
            }
            ""
        }
        _ => {
            if !rest.is_empty() {
                return Err(error(tag));
            }
            ""
        }
    };
    Ok(Some(format!(
        "{action}{direction}{}",
        duration.map(|d| format!(" {d}s")).unwrap_or_default()
    )))
}

fn take_duration(rest: &str, original: &str) -> Result<(String, Option<f64>), String> {
    let mut parts: Vec<&str> = rest.split_whitespace().collect();
    let Some(last) = parts.last().copied() else {
        return Ok((String::new(), None));
    };
    let number = if matches!(last, "seconds" | "second" | "secs" | "sec" | "s") {
        parts.pop();
        Some(parts.pop().ok_or_else(|| error(original))?)
    } else {
        ["seconds", "second", "secs", "sec", "s"]
            .iter()
            .find_map(|suffix| {
                last.strip_suffix(suffix)
                    .filter(|n| n.chars().next().is_some_and(|c| c.is_ascii_digit()))
            })
            .inspect(|_| {
                parts.pop();
            })
    };
    let Some(number) = number else {
        return Ok((rest.into(), None));
    };
    let value = number
        .replace(',', ".")
        .parse::<f64>()
        .map_err(|_| error(original))?;
    if !number
        .chars()
        .all(|c| c.is_ascii_digit() || c == '.' || c == ',')
        || !value.is_finite()
        || !(MIN_LINE_SECONDS..=MAX_LINE_SECONDS).contains(&value)
    {
        return Err(error(original));
    }
    if parts.last() == Some(&"for") {
        parts.pop();
    }
    Ok((parts.join(" "), Some(value)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounded_english_corpus_normalizes_supported_actions() {
        for (input, expected) in [
            ("walk to the left for 2 seconds", "kävele vasemmalle 2s"),
            ("Walking right 2.5 s", "kävele oikealle 2.5s"),
            ("running straight ahead for 3 seconds", "juokse suoraan 3s"),
            ("waving hello 2s", "vilkuta 2s"),
            ("jumping for 1.2 seconds", "hyppää 1.2s"),
            ("crouching 2,5 sec", "kyykisty 2.5s"),
            ("nodding 2s", "nyökkää 2s"),
            ("waiting for 2 seconds", "odota 2s"),
            ("texting on the phone 3s", "näpyttele puhelinta 3s"),
            ("tap phone", "näpyttele puhelinta"),
            ("sit on the chair for 2 seconds", "istu tuolille 2s"),
            ("standing up 2s", "nouse tuolilta 2s"),
            ("typing on phone 2s", "näpyttele puhelinta 2s"),
            ("look toward camera", "look at camera"),
            ("camera close up", "shot close-up"),
            ("emotion cheerful", "expression happy"),
        ] {
            assert_eq!(
                normalize_tag(input).unwrap().as_deref(),
                Some(expected),
                "{input}"
            );
            assert!(
                crate::parse(&format!("[{input}]\nKALLE: Hello. [wait]")).is_assemblable(),
                "{input}"
            );
        }
    }

    #[test]
    fn unsupported_ambiguous_or_negated_english_cues_are_errors() {
        for cue in [
            "walk",
            "running",
            "walk backward",
            "walk left and right",
            "walk left quickly",
            "run to Maija",
            "wave and jump",
            "nod left",
            "wave hello forever",
            "wait 2",
            "wait for -2 seconds",
            "wait for 1e1 seconds",
            "wait for 21 seconds",
            "wait 0s",
            "texting a novel",
            "tap keyboard",
            "don't wave",
            "do not run left",
            "never jump",
            "camera orbit",
            "camera close up 2s",
            "emotion furious",
            "look toward Maija and Kalle",
            "sit down",
            "open the door",
            "fly away",
        ] {
            assert!(normalize_tag(cue).is_err(), "{cue}");
            assert!(!crate::parse(&format!("[{cue}]")).is_assemblable(), "{cue}");
        }
        for unrelated in [
            "vilkuta 2s",
            "kävele vasemmalle 3s",
            "ilme iloinen",
            "esine kahvikuppi",
            "microwave",
            "brunch",
        ] {
            assert_eq!(normalize_tag(unrelated).unwrap(), None, "{unrelated}");
        }
        // Unrecognized leading modifiers must not reach legacy substring action
        // recognition and silently select a movement from a later keyword.
        for cue in [
            "please wave hello",
            "slowly walk left",
            "go and run right",
            "fly then jump",
            "walk left 2s wave",
        ] {
            assert!(!crate::parse(&format!("[{cue}]")).is_assemblable(), "{cue}");
        }
    }

    #[test]
    fn command_catalog_examples_round_trip_the_real_parser() {
        for command in COMMANDS {
            assert!(!command.description.is_empty());
            let canonical = normalize_tag(command.example).unwrap().unwrap();
            let original = crate::parse(&format!("[{}]\nKALLE: Hello. [wait]", command.example));
            let normalized = crate::parse(&format!("[{canonical}]\nKALLE: Hello. [wait]"));
            assert!(original.is_assemblable(), "{}", command.example);
            assert_eq!(original.beats, normalized.beats, "{}", command.example);
        }
    }

    #[test]
    fn equivalent_command_wording_keeps_event_ids_and_exact_original_source() {
        let short = "KALLE: Hello. [walk left 2s]";
        let natural = "KALLE: Hello. [walking to the left for 2 seconds]";
        let a = crate::to_timeline(&crate::parse(short), short, hs_core::Fps(30));
        let b = crate::to_timeline(&crate::parse(natural), natural, hs_core::Fps(30));
        assert_eq!(a.events.len(), b.events.len());
        for (original, rewritten) in a.events.iter().zip(&b.events) {
            assert_eq!(original.id, rewritten.id);
            assert_eq!(original.kind, rewritten.kind);
            assert_eq!(original.duration, rewritten.duration);
            assert_eq!(original.source.text, short);
            assert_eq!(rewritten.source.text, natural);
        }
    }
}
