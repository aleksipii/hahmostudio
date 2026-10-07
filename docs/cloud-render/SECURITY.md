# Security

Trusted: rule engine, canonical state, compute policy, model policy, server environment. Untrusted: AI output, request bodies, prompt fragments, backend responses.

- Auth: routes sit behind the existing owner login; non-GET needs same-origin `Origin` and JSON content type; bodies ≤ 2 MiB.
- Policy cannot be set by a client: no write route, strict request parsing (HTTP 400 for policy-like fields), policy objects frozen.
- AI path has no reference to policy/store/storage; AI output is parsed strictly and validated before any use.
- Provider calls need a firewall-issued, job- and backend-bound token (unforgeable `WeakMap` registry).
- Closed-world lookups use `Object.hasOwn`; prototype-pollution ids rejected.
- Storage: sanitized names, folder allowlist, no weights; local storage cannot escape its root.
- Backend outputs: type allowlist, magic-byte sniffing, size cap, weight files refused.
- Audit log is hash-chained: detects edits, not a replacement of the whole chain.
- Secrets (Drive tokens, ComfyUI bearer, HF token) come from server env; never sent to the browser or logged.

Residual risks: the ComfyUI endpoint must be reachable only over HTTPS and protected (Colab tunnels are often public URLs, so use the bearer option). A malicious operator-configured backend could return convincing but wrong images; output inspection is a hook only.
