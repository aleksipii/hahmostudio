# Hallucination prevention

The prompt is a secondary protection. The real protection is code that runs before anything is rendered.

| Layer | What is checked | Code |
|---|---|---|
| 1 Structured output | Strict schema; unknown fields (including `computePolicy`, `canonicalState`) are rejected, not ignored; enums for camera/lighting/atmosphere | `parseSuggestion` |
| 2 Entities (closed world) | Every character/prop/location/target must exist **and** belong to the scene; location must equal the scene's; visual style must be in the project's list | `validateSuggestion` |
| 3 Attributes | Claimed attributes must exist in canon and equal it; unknown attribute = reject | same |
| 4 Actions | Must be in `allowedActions`, not in `forbiddenActions`, target kind must match; state-changing actions must echo an approved event | same |
| 5 Timeline | `at` must lie in the scene window | same |
| 6 Continuity | Scene-start state is replayed from all earlier events; characters must be in the scene location or have an approved transition; location/holding claims compared with replayed state | `continuity.ts` |
| 7 Prompt fragments | Charset allowlist, injection patterns, and every word must be in the visual vocabulary or a canonical name/value ("blue dress" is rejected when canon says red jacket) | `vocabulary.ts` |
| 8 Output | Container sniffing, size, expected dimensions, weight-file refusal, optional `OutputInspector` (secondary, never authoritative); strictness `reject` escalates flags | `output-validation.ts` |

Mechanisms that make skipping validation impossible: `compilePrompt` accepts only objects minted by the validator (WeakSet brand); the pipeline cannot reach a backend without passing the validator; unknown values are rejected, never "corrected".

Prompt injection: user/AI text cannot reach policy (policy is server-only, request bodies with policy-like keys get HTTP 400) or canon (only `RuleEngine` writes).

Limits (honest): fragment vocabulary is deliberately small, so valid but unusual style words are rejected until added. Visual identity drift in the *rendered image* is not detected unless an `OutputInspector` is supplied.
