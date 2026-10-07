# Model licences

`ModelDefinition` records `source`, `revision`, `license`, `commercialUse` (`allowed|restricted|unknown|not-allowed`), `licenseEvidenceUrl`, `licenseCheckedAt`, optional file checksums.

PRODUCTION_SAFE requires: `commercialUse==="allowed"`, evidence URL, check date, a pinned 40-hex revision, and (when present) valid SHA-256s. DEVELOPMENT mode relaxes only the licence/evidence/pin requirements, never cost.

Rules enforced by tests:
- Apache-2.0 is accepted only when the metadata says `allowed` with evidence; an `apache-2.0` string alone is not trusted.
- `restricted`, `unknown`, `not-allowed` are blocked in PRODUCTION_SAFE.
- An explicitly requested model is never silently replaced.
- The registry is immutable at runtime; pins cannot change licence fields.

Evidence level: licence strings come from Hugging Face model-card tags read on 2026-10-07. This is **not legal review**. It does not cover third-party components, training-data claims, or use-based restrictions (OpenRAIL). Re-check before commercial release.
