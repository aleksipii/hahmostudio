# Compute policy

```json
{"mode":"zero-cost","allowPaidCompute":false,"maxCostEur":0,"allowPaidFallback":false,"allowUnknownCost":false}
```
This is the default and is frozen in code (`ZERO_COST_POLICY`). It is read **only from the server environment** (`loadComputePolicy`):

- Paid compute needs both `HAHMOSTUDIO_ALLOW_PAID_COMPUTE=yes-i-accept-charges` (exact string) and `HAHMOSTUDIO_MAX_COST_EUR` in (0, 1000]. Anything looser stays zero-cost.
- `allowPaidFallback` and `allowUnknownCost` are literal `false` types; setting `HAHMOSTUDIO_ALLOW_PAID_FALLBACK` or `HAHMOSTUDIO_ALLOW_UNKNOWN_COST` makes the server refuse to start.
- The API exposes policy read-only; writes return 405. Render requests containing policy-like fields return 400.

## Gate and firewall
1. `estimateCost` is declarative and never contacts a provider.
2. `ComputeCostGate.authorize` blocks: disabled backend, unknown/disallowed class, paid class when paid is off, unknown billing provider, unknown/negative/NaN cost, cost > max, any non-zero cost in zero-cost mode.
3. `PaidComputeFirewall.clear` re-derives everything from the backend itself (it does not trust the gate's object), then mints an `ExecutionToken` bound to job + backend.
4. Every provider-touching method (`validate`, `render`) calls `assertToken`. Without the token the call throws before any I/O. Tests assert `providerCalls` is empty for every blocked path.

## No fallback
`BackendRegistry.select` is static (explicit id, or first backend whose classification passes policy). There is no try/catch-then-next loop: unavailable free backend → BLOCKED; render failure → FAILED. Tested with an enabled paid backend sitting next to a failing free one.

## Default backends
`colab-free` (class free) is **disabled** unless `HAHMOSTUDIO_COLAB_COMFYUI_URL` (https) and `HAHMOSTUDIO_COLAB_CLASSIFIED_FREE=yes` are both set: an explicit operator statement that this exact execution path is free. `runpod` and `modal` are paid and permanently disabled placeholders.

## Display
`GET /api/compute/policy`, `GET /api/compute/estimate`, and the dialog show: compute cost, maximum, paid compute DISABLED, paid fallback DISABLED.
