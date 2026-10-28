# Message Design Spec v0.1

Status: draft, nothing built yet. License intent: Apache-2.0.
Companion to `HANDOFF-PACK-SPEC.md`. That spec defines the pack. This one defines the three ways a pack can be handed over.

## One sentence

Three designs of the same handoff, differing in one axis only: whether the receiver's obligations are **implied**, **declared**, or **declared and enforced**.

## The one axis

| | Free text | Structured | Structured + contract |
|---|---|---|---|
| id | `F` | `S` | `C` |
| carrier | prose | JSON pack | JSON pack |
| scope boundary | implied, receiver must infer | declared, receiver must honor by convention | declared **and enforced**, violating it fails at the call |
| expiry | implied | declared, honored by convention | declared **and enforced** by the token |
| acceptance criteria | implied | declared as text | declared **and compiled** to a machine-checkable predicate |
| revocation | impossible to observe | polled by convention | checked before every use, cryptographically |
| organizational analogy | verbal briefing | written work order | contract |

The axis is enforcement, not verbosity. All three carry the same facts.

This matters because the paper's question is whether *structure* and *commitment* are substitutes or complements. If `C` only differed from `S` by being longer, the answer would be trivial. It does not: `C` is `S` plus a capability token that makes a boundary violation a runtime error instead of a discipline problem.

## Definitions

### Design F: free text

The sender writes a natural-language briefing. No schema, no field order, no validation.

There is exactly one valid rendering of a pack as free text, and it is produced mechanically by `renderToProse()`, never by a human. See below.

### Design S: structured

The pack from `HANDOFF-PACK-SPEC.md`, as JSON, validated by zod on receipt. Rejected if malformed, over-length, or missing `verify`.

Obligations are **declared**. A receiver that acts outside `scope` is misbehaving, and nothing stops it.

### Design C: structured plus contract

Everything in `S`, plus:

1. **`token`** : the capability token from `HANDOFF-PACK-SPEC.md` rule 2. HMAC chained signature over `{ scope, expires_at, issued_at, parent }`. A receiver can present only what it was given, and can only narrow further.
2. **Enforced scope** : an action outside `token.scope` fails at the call with `action not in scope`. It is not a policy check the receiver could skip, it is a signature the call site cannot forge.
3. **Machine-checkable `verify`** : `verify` is not a sentence. It is `{ kind, args }` naming a registered checker, and `close` refuses to pass until the checker returns true.
4. **Replay protection** : the token payload carries a `jti`. A `jti` consumed once cannot be used again. This is what makes scenario 10 different from scenario 3.
5. **Enforced revocation** : `revoke_handle` is consulted before every single use, not only at accept.

### C has two enforcement modes, and they answer different questions

Point 2 above is a boolean on the gateway, and that boolean is worth more than one experiment. The encoding is identical either way; only whether the gate acts on a violation differs.

| Design id | Gate behaviour | Yields |
|---|---|---|
| `C-shadow` | verifies the signature, logs `c_would_block`, then **allows the call** | commitment measured as a signal, with the adaptation cost still observable |
| `C` | verifies the signature and **rejects** the call | commitment measured as enforcement, reported as a block count |

**The design ids are exactly `C-shadow` and `C`.** An earlier draft called the second one `C-enforce`. That alias is retired: two names for one arm is how a doc set drifts, and it already happened once, with the analysis plan keeping the old name after the paper plan dropped it. Write `C`. Where a sentence needs to contrast the two, say "arm `C`" and let the mode be the thing that differs.

`C` is what the main grid runs. `C-shadow` is a mechanism sub-study and never enters the main grid.

**Why this exists.** With enforcement on, an out-of-scope action never happens, so nothing is ever reworked. Arm `C`'s adaptation cost is then zero by construction rather than by good behavior, and comparing it against `S` measures the architecture, not the agents. Running `C-shadow` alongside `S` gives a contrast where both cells are real. See `COORDINATION-COST-SPEC.md`, section "`C_adapt` is degenerate in `C`".

This is a mode flag on the gate, not a fourth message design, so `encode`, `decode` and `renderToProse` are untouched.

### C depends on the token actually working

**The contract arm is only meaningful if the signature chain is real.** The archived plan (`archive/PLAN-v1-2026-10.md`) specifies a `narrowToken` that decodes the parent payload without verifying its signature, then discards the parent link and mints a fresh token with the same global secret. Under that implementation:

- a forged parent token is accepted as a real parent
- no receiver can prove its token descends from anything
- an out-of-scope action is rejected by an application-level check, not by a signature

That is design `S` wearing a token. If it ships unfixed, `C` cannot report `c_blocked_by_enforcement`, hypothesis H2 has no mechanism, and the paper's central distinction collapses into a prompt difference.

**Therefore: fixing the chain signature is the first task of P1, ahead of writing any of the three designs.** Until `narrowToken` verifies its parent and links to it, this spec describes an intention, not an implementation.

## The information-equivalence gate

This is the single most important correctness property of the whole benchmark.

**Rule.** For any pack `p`, the three arms carry identical information. `F` is exactly `renderToProse(p)`. `S` is exactly `p`. `C` is exactly `p` plus its token, and the token's payload is a deterministic function of `p`.

### `verify` carries two renderings, both mechanical

`verify` is a machine predicate, something like `{ kind: "json_eq", args: [...] }`. Interpolating that straight into prose produces `the sender will check the result with: {"kind":"json_eq",...}`, which is unreadable and would push free-text receivers into extra clarification rounds. That would inflate `C_search` for the wrong reason and pollute H1.

So `verify` is authored once and rendered twice, by the same pure function, from the same source:

| Field | Form | Used by |
|---|---|---|
| `verify.statement` | one canonical human-readable sentence | `F`, `S`, and `C` all carry it |
| `verify.predicate` | the machine-checkable `{ kind, args }` | `C` only |

The sentence is generated from the predicate, not written alongside it, so the two cannot drift apart. A pack whose sentence cannot be rendered from its predicate is a bug and is rejected at creation, the same way an over-length SBAR field is.

Consequence: `F` and `S` receive identical, readable acceptance criteria, so the readability penalty never lands on free text alone. `C` receives strictly more, and that surplus is exactly what commitment means here.

**`renderToProse(p)` is a pure function**, defined here, not implemented by a model and not written by a person:

```
handoff {to.agent} in {to.workspace}:

situation: {p.situation}
background: {p.background}
assessment: {p.assessment}
recommendation: {p.recommendation}

you may perform: {p.scope.actions joined ", "}
context you may reference: {p.scope.context_refs joined ", "} (resolve with your own permissions)
this expires at {p.expires_at}
the sender will check the result with: {p.verify.statement}
```

No model writes the free-text arm. If a model wrote it, the free-text arm would win or lose on writing quality, and the benchmark would measure prompt engineering instead of message design.

**Audit procedure.** Every benchmark run emits, per handoff: the byte length of each arm's payload, the token count of each arm as delivered to the receiver, and a field-coverage assertion that every key of `p` appears in the rendered prose. A run whose assertion fails is discarded, not repaired.

**Honest reporting.** `C` is expected to cost more to *write* than `F`. The benchmark reports that cost rather than hiding it, and the headline metric is cost **per successful task**, not cost per message.

## What is held constant across arms

Per `AGENTS.md` rules 11 and 12. Any deviation invalidates the run:

| Held constant | Value |
|---|---|
| model | identical snapshot id, never an alias |
| system prompt | identical skeleton, only the payload block is swapped |
| tool access | identical |
| temperature, top_p | identical |
| topology, N | identical |
| task instance | identical seed |
| turns, deadline | identical |

Only the payload block differs.

## Interface

```typescript
export interface MessageDesign {
  readonly id: "F" | "S" | "C";
  /** Render an outgoing pack into this design's carrier form. */
  encode(pack: Pack, ctx: EncodeContext): Payload;
  /** Recover a Pack from a received carrier form. F may lose fidelity; see below. */
  decode(payload: Payload, ctx: DecodeContext): DecodeResult;
  /** Actions the receiver can actually take, after enforcement. */
  permittedActions(pack: Pack, token: Token | null): readonly string[];
}

export const DESIGNS: Record<DesignId, MessageDesign>;
```

### The fidelity asymmetry, stated honestly

`decode` is lossy for `F`. Prose does not delimit fields, so recovering a machine-checkable `scope.actions` list from it is a guess. This is not a bug to be fixed, it **is the treatment**: `F`'s entire cost is that the receiver must reconstruct what a structured arm would have handed them.

`DecodeResult` therefore carries a `confidence` and an `unresolved: string[]`. An `F` receiver whose parse is uncertain must ask, and that ask is exactly what `C_search` counts.

## Open questions

- Does `F` get a manual writing guideline, or pure mechanical rendering? Recommendation: pure mechanical, plus 3 human-authored exemplars used only as prompt priming, identical across all arms.
- Should `C` include the signature bytes in the transmitted payload, or only a reference to them? Recommendation: reference only, since signatures are verifiable out of band and bytes would inflate `C_spec` for reasons unrelated to the theory.

## References

- `HANDOFF-PACK-SPEC.md` : the pack, the seven rules, the ten scenarios
- `COORDINATION-COST-SPEC.md` : what each arm is measured against
- `../AGENTS.md` : rules 11 and 12, the constant-across-arms contract