# Google Drive storage

`StorageBackend` (`createProject`, `uploadAsset`, `downloadAsset`, `uploadRender`, `listProjectAssets`, `deleteAsset`) has three implementations: `GoogleDriveStorage`, `LocalDevelopmentStorage` (same folder layout, dev only), `InMemoryStorage` (tests).

Layout:
```
AnimationStudio/Projects/<projectId>/{project.json, characters, scenes, props, references, workflows, renders, metadata, logs}
```
Uploaded per job: renders, `metadata/<job>.record.json` (full record incl. reproducibility), `logs/<job>.audit.json` (hash-chained audit), canonical state, scene locks, reference-image index.

Auth: OAuth refresh token from server env (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`); scope `https://www.googleapis.com/auth/drive.file` is enough. Missing credentials make every Drive call fail closed. Without Drive credentials the server uses local-dev storage only if `HAHMOSTUDIO_STORAGE=local-dev`.

Guards on every upload: safe project/asset names, known folder, **model-weight extensions refused** (`.safetensors .ckpt .bin .pth .pt .gguf ...`), size cap.

Not tested against the real Drive API (HTTP is faked in tests). Drive quota/plan limits apply and are not metered.
