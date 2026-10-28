# Coordination Cost Spec v0.1

Status: draft, nothing built yet. License intent: Apache-2.0.
Companion to `MSG-DESIGN-SPEC.md`. That spec defines what is varied. This one defines what is measured.

## One sentence

Coordination cost is what an organization pays for work it does not directly: the effort of understanding a handoff, writing it, routing it, and living with the result.

## Why decompose it

"Efficiency" is not a measurement, it is a mood. "Coordination cost" is a measurement only once you say which part of coordination you mean, because the parts move in opposite directions.

The decomposition is the contribution, not a convenience. Structure buys a reduction in one component and pays for it in another. If you only measure the total, the trade is invisible and you can never tell structure from commitment.

## Four components

Every component is measured in three currencies at once: **input plus output tokens**, **USD**, and **wall-clock seconds**. Any headline number quotes all three or names which one it uses.

### C_search: search and parsing

The receiver's cost to work out what the sender meant.

| Signal | Definition | Collection point |
|---|---|---|
| `clarification_rounds` | number of agent-to-agent turns where the receiver asks the sender for clarification before acting | counted in the transcript |
| `redundant_constraint_rate` | fraction of sender constraints the receiver restates back to the sender unprompted | grader on the transcript |
| `first_pass_comprehension` | 1 if the receiver's first action is admissible under the pack's scope, 0 if it needs a correction first | the scope check is already implemented |
| `unresolved_fields` | `DecodeResult.unresolved.length`, see `MSG-DESIGN-SPEC.md` | `decode` return value |

`first_pass_comprehension` and `unresolved_fields` are cheap and exact. `clarification_rounds` and `redundant_constraint_rate` need a grader, so they are reported separately and never silently averaged with the cheap signals.

### C_spec: specification and restatement

The cost of writing the handoff and of reading it back.

| Signal | Definition | Collection point |
|---|---|---|
| `sender_tokens` | tokens the sender spent producing the handoff, split encode from surrounding reasoning | response usage |
| `receiver_tokens` | tokens the receiver spent reading it | response usage |
| `payload_bytes` | carrier bytes on the wire | encoder |
| `message_count` | handoffs needed to move one unit of work | counted in the transcript |

`sender_tokens` split matters. If `F` is cheap to write but `C` is expensive, that difference *is* finding H4.

### C_coord: coordination while working

The cost of the handoff happening at all.

| Signal | Definition | Collection point |
|---|---|---|
| `handoff_latency_ms` | wall-clock from sender emit to receiver first action | timestamps |
| `blocked_ms` | time a receiver spends unable to proceed on its own work | dependency graph |
| `handoff_depth` | number of handoffs on the longest path through the organization | topology |

### C_adapt: adaptation after the fact

The cost of living with the handoff once work has started. This is where commitment is supposed to act.

| Signal | Definition | Collection point |
|---|---|---|
| `verify_failures` | times the machine-checkable predicate returned false | `verify` checker |
| `out_of_scope_actions` | attempts to act outside `scope` | token gate |
| `c_blocked_by_enforcement` | out-of-scope attempts stopped by a signature failure, design `C` only | token gate |
| `c_would_block` | out-of-scope attempts the gate stopped short of stopping, design `C-shadow` only | token gate |
| `s_blocked_by_policy` | out-of-scope attempts the model declined on its own, **all four designs** | transcript grader |
| `rework_rounds` | times completed work was redone | transcript |
| `revoke_events`, `replay_blocks` | revocations issued, replays rejected | `jti` ledger |

**The two block counters are not comparable and must never be subtracted.** `s_blocked_by_policy` is the model choosing not to misbehave. `c_blocked_by_enforcement` is a call site physically unable to misbehave. Their difference is not a treatment effect, it is a difference between compliance and cryptography.

**`s_blocked_by_policy` is recorded in all four designs, and this is deliberate.** It measures model behaviour, and the model behaves the same way in every arm: it is asked to act, and it may decline before the call ever reaches the gateway. Scoping it to `F` and `S` would discard the one enforcement-adjacent signal that is observable in `C-shadow`, which is precisely the arm H2 needs. The order is generate, then gate, so enforcement does not censor the model's opportunity to self-decline.

**`c_blocked_by_enforcement` is structurally absent in `F`, `S`, and `C-shadow`.** Record it as `null`, never as `0`. A `0` asserts that zero attempts happened, which is a claim about the run; `null` asserts the design has no mechanism to block with, which is a claim about the design. Treating `null` as `0` in a mixed-effects model turns a capability difference into a fabricated performance number.

**`c_would_block` is the mirror image: it exists only in `C-shadow`, and `null` elsewhere.** `c_blocked_by_enforcement` and `c_would_block` answer the same question about the same underlying behaviour, one with the gate armed and one with it disarmed. Reporting both makes the pair `c_would_block` in `C-shadow` against `c_blocked_by_enforcement` in `C` a within-run consistency check on the gateway: if the two numbers diverge materially, the gate is doing something other than what the spec says, and every `C`-arm result is suspect until it is explained.

### `C_adapt` is degenerate in `C`, and this must be said out loud

**A treatment that eliminates its own outcome cannot be used to measure that outcome.** When the gateway blocks an out-of-scope action, no work was done, so there is nothing to rework. `rework_rounds` in arm `C` is therefore driven toward zero by construction, not by better behavior. The same applies to `out_of_scope_actions` if it is counted after the block rather than at it.

Consequence, stated plainly: **in the main three-arm grid, arm `C`'s `C_adapt` is a degenerate cell and is not a valid estimate of anything.** It is reported and labelled degenerate. It is never plotted as a performance number and never entered into a sum with the other three components. Any figure that shows `C`'s adaptation cost near zero as if it were a win is misleading, because it is a description of the architecture, not of the agents.

### `C-shadow`: the probe that makes H2 testable

Add a fourth design, `C-shadow`. It uses `C`'s exact message encoding and token, but the gateway runs in observe-only mode: it verifies the signature, logs whether it **would** have blocked, and then allows the call through.

```
S          = declared, no enforcement        <- baseline
C-shadow   = declared, enforcement observed but not applied
C          = declared, enforcement applied
```

This splits the single axis in two and separates two things the three-arm design had fused:

| Contrast | Isolates | Both cells measurable |
|---|---|---|
| `S` to `C-shadow` | **commitment as signal**: what declaring obligations does when nothing enforces them | yes, nothing is blocked, rework is observable |
| `C-shadow` to `C` | **commitment as enforcement**: what the gate itself changes | partially, see below |

**The design space is an L, not a full 2 by 2.** Crossing the two axes gives four cells, but only three are inhabited:

| | no explicit declaration | explicit declaration |
|---|---|---|
| no enforcement | `S` | `C-shadow` |
| enforcement | **structurally empty** | `C` |

The bottom-left cell cannot be built. Enforcement has nothing to enforce until the obligation is written down, so "declared and not enforced" and "declared and enforced" are both reachable while "undeclared and enforced" is not. Call this cell **structurally empty** rather than not applicable: not applicable reads like an optional record, structurally empty states the shape of the design space. Two consequences follow, and both must survive into the paper. First, enforcement is a second-order mechanism that sits on top of declaration, so there is no path that skips declaration. Second, the `C-shadow` to `C` contrast is **conditional** on having already crossed the declaration threshold, and every claim built on it must carry that condition.

**H2 is re-specified to be tested on `S` to `C-shadow`**, not `S` to `C`. Commitment measured as a signal is a behavioral treatment whose effect can be observed. The `C-shadow` to `C` contrast is reported as a mechanism count (`c_would_block` against `c_blocked_by_enforcement`), never as an adaptation-cost effect.

Implementation cost is one boolean on the gateway, not a fourth message design. Compute cost is real, so it runs as a **pre-planned mechanism sub-study**, not a full fourth grid arm: `T2` only, topologies chain and hub-and-spoke, `N` in {8, 32}. It gets its own preregistered analysis and its own budget line.

| | main grid | mechanism sub-study |
|---|---|---|
| Arms | `F`, `S`, `C` | adds `C-shadow` |
| Tasks | `T1`, `T2`, `T3` | `T2` only |
| Topologies | all four | chain, hub-and-spoke |
| Scales | 8, 32, 96 | 8, 32 |
| Powers | H1, H2, H3, H4, H5 | H2 mechanism only |

## Quality, tracked separately

Cost without quality is a degenerate game, since the cheapest handoff is a useless one.

| Signal | Task family | Definition |
|---|---|---|
| `task_success` | all | did the run produce a valid artifact |
| `optimality_gap` | T1 | relative distance from the analytic optimum |
| `test_pass_rate` | T2 | unit tests plus static checks |
| `rubric_score` | T3 | LLM judge, calibrated against a human-scored subsample |

## Headline metrics

**Primary.** `cost_per_success`, per component and total, in all three currencies.

```
cost_per_success = (sum of component cost over runs) / (number of successful runs)
```

Reported per unit of work, because a run with more agents does more work.

**Secondary.** `CCI`, the Coordination Cost Index, a single scalar for the leaderboard:

```
CCI = 100 * sum_c weight_c * normalize_c(cost_per_success_c)
```

Weights are fixed and published before results are seen. Normalization is against a fixed reference task, so the index is comparable across submissions. If normalization drifts, the index is meaningless and the leaderboard is theater.

Three variants are published, not one, so that one choice of weights cannot move the ranking by itself:

| Variant | Weights | What it ranks |
|---|---|---|
| `CCI-C` | `search`, `spec`, `coord` at one third each, `adapt` at zero | main leaderboard. All three arms measure all three components, so the comparison is not circular |
| `CCI-Full` | all four at one quarter each | the only case where `adapt` would matter, and even here it does not mean the same thing across arms because only `C` can mechanically block an out-of-scope action. Folding it into one scalar is circular, so `CCI-Full` is reported but is not the leader |
| `CCI-Adapt` | `adapt` only, normalized | diagnostic column, not a ranking, since a single component is noise dominated at the cell sizes here, and because `adapt` is degenerate in `C`. It is only meaningful on `C-shadow` |

**Weight sensitivity is mandatory.** Re-rank across a grid over the weight simplex and report how often the top three hold their positions. If the leader changes in more than half the weight configurations, the leaderboard page says so in those words. A ranking that hides its own instability is worse than no ranking.

Full specification, including the normalization function and anti-gaming rules for the public board, is in `docs/05-增长与发布计划.md`.

## Units of analysis

The unit is **one run**: a full execution of one task under one topology, one scale, one seed and one design.

Seeds are the replicate. Runs nest in task instances, which nest in tasks. The statistical model reflects that nesting, see `docs/03-分析与统计计划.md`.

**Pseudo-replication warning.** A single run produces many handoffs. Those handoffs are not independent observations. Never report per-handoff statistics as if they were per-run. The run is the unit.

## Anti-gaming rules

1. A design that never completes has infinite cost per success, not zero.
2. A run that hits the turn or time limit is a failure at full cost, never discarded as an outlier.
3. Truncated runs count against the design that caused them.
4. Every number quoted in the paper resolves to a key in `results/numbers_manifest.json` and is regenerated offline from the raw transcripts by `analysis/verify_numbers.py`.

## What is deliberately not measured

- Human baseline performance beyond the small `N = 12` pilot in `docs/02-实验设计.md`
- Perceived naturalness or readability of the handoff, which would require human raters at a scale this project does not have
- Multi-modal carriers

Each is a real limitation, not an oversight. Stating them here keeps the paper honest.

## References

- `MSG-DESIGN-SPEC.md` : the three designs being measured
- `HANDOFF-PACK-SPEC.md` : the pack and the lifecycle that produce these signals
- `../docs/02-实验设计.md` : task families, topologies, the matrix
- `../docs/03-分析与统计计划.md` : the model that consumes these numbers