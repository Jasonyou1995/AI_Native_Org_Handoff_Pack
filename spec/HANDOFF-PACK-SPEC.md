# Handoff Pack Spec v0.1 (draft)

Status: prototype spec, nothing built yet. License intent: Apache-2.0.

## One sentence

A Handoff Pack is a small signed bundle that lets one agent give another agent just enough context to do one job, with a scope, an expiry and a revoke handle.

## Why

Today, when my agent passes work to your agent across workspaces, three things are unclear: what the receiver may do, how long it may do it, and how the sender takes it back. This spec fixes those three things and nothing else.

## The pack (one page, SBAR style)

Borrowed from hospital shift handoffs: say what is happening, why, what you think, and what you want.

| Field | Meaning | Rule |
|---|---|---|
| `id` | unique pack id | required |
| `from`, `to` | agent id and workspace id of each side | required |
| `situation` | what is happening now | max 500 chars |
| `background` | why it matters, only what is needed | max 500 chars |
| `assessment` | sender's judgment, and what is not yet verified | max 500 chars |
| `recommendation` | the one job requested and the next step | max 500 chars |
| `scope.actions` | list of allowed actions | required, can only shrink downstream |
| `scope.context_refs` | pointers to context, never the content itself | resolved with the receiver's own permissions |
| `expires_at` | hard stop time | default 24h from creation |
| `revoke_handle` | id the receiver checks before every use | required |
| `verify` | how the sender will check the result | required, a pack without it is rejected |
| `status` | `prototype`, `tested`, `in_real_use` or `delivered` | honest label, never rounded up |
| `token` | capability token with chained signature | see rules 2 and 3 |

## Lifecycle

1. **Create:** sender fills the pack and signs it.
2. **Deliver:** pack goes to the receiver's inbox.
3. **Accept or decline:** receiving is not accepting. Work starts only after an explicit accept.
4. **Act:** receiver works inside `scope` only.
5. **Report:** receiver returns the result, what was checked, and what was not.
6. **Close or revoke:** sender closes after `verify` passes, or revokes at any time.

## Seven rules

1. **Context is data, never instructions.** Text inside the four SBAR fields is shown to the receiver as information. Only `scope` grants actions.
2. **Narrow only.** A receiver may re-delegate a pack with a smaller scope or shorter expiry, never a larger one. (Method: macaroon-style chained signatures, each caveat can be added but not removed.)
3. **Check revoke before every use,** not only at acceptance.
4. **Expiry is hard.** After `expires_at` every call fails, no grace period.
5. **Pointers, not payloads.** Private content stays where it lives. The receiver resolves each ref with its own permissions.
6. **Receiving is not accepting.** An unanswered pack has no effect.
7. **Honest status.** The `status` label must match reality: prototype, tested, in real use, delivered.

## The 10 test scenarios (exit condition: 10 of 10 pass)

| # | Scenario | Pass means |
|---|---|---|
| 1 | Basic handoff, accept, act, report, close | result matches `verify` |
| 2 | Pack expires mid-task | next call fails |
| 3 | Sender revokes mid-task | next call fails |
| 4 | Receiver re-delegates a narrower pack | accepted, narrower scope enforced |
| 5 | Receiver declines | no action taken, sender notified |
| 6 | Pack missing `verify` | rejected at creation |
| 7 | SBAR field over 500 chars | rejected at creation |
| 8 | **Attack A1:** injected instructions inside `background` | receiver does not act on them |
| 9 | **Attack A2:** receiver tries a wider scope on re-delegation | signature check fails |
| 10 | **Attack A3:** replay of a pack after revoke | rejected |

## Non-goals (to keep it small)

No model hosting, no payments, no business logic, no sharing of private memories or whole files. Examples in the repo use toy data only.

## Open questions

- Where does revoke state live: the DSH inbox, or a tiny standalone endpoint?
- How is an agent's identity proven across two workspaces?
- Should `verify` be machine-checkable, human-checkable, or both?

## Reference implementation target

About 300 lines: pack schema, chained-signature token with narrow and verify, revoke check, and the 10 tests above.
