# Zero-Cost Mode

**Guarantee:** in Zero-Cost Mode the application will not intentionally invoke a paid compute backend.

**Not guaranteed:** that a free GPU is available. If none is, the render is `BLOCKED` and nothing is tried instead.

```
RENDER BLOCKED

<reasons>

Paid compute is disabled unless server policy enables it.
No paid fallback was attempted.
No provider API was contacted.
```
(The last line is replaced by a precise statement when the runtime was contacted only for validation.)

## Four different costs
| Cost | Meaning | Handled by |
|---|---|---|
| Model cost | Price/licence fee of weights (`modelCostEur`, usually 0 for open models) | `assessModel` |
| GPU compute cost | Runtime billing | `ComputeCostGate`, `PaidComputeFirewall` |
| Storage cost | Google Drive quota/plan | not modelled; Drive limits apply |
| Network cost | Egress/bandwidth | not modelled |

A free model can run on a paid GPU; an open licence does not make the system free. Only the compute cost is enforced by code; storage and network are documented, not metered.

## Hidden costs
No paid LLM, embedding or API is called by default. `LLMDirector` exists as an adapter but is never constructed by the shipped server; wiring one is an explicit code change and its cost is outside the compute gate (documented here on purpose).
