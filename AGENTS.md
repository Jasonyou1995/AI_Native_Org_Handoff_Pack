# AGENTS.md: guide and rules for any AI coder (Claude Code, Codex, Cursor, others)

Read this first, every session. Then read `spec/HANDOFF-PACK-SPEC.md` and `docs/00-总体规划.md`.

## What this project is

An open-source handoff-pack: one agent hands a job to another agent across workspaces, with a scope, an expiry and a revoke handle. On top of that library sits a **coordination-cost benchmark**: a simulator that runs hundreds of agent workers inside an organization and compares three handoff-message designs (free text, structured, structured plus contract semantics) on how much coordination they cost.

The project currently has specifications and plans only: no implementation code or verified behavior. Keep that status explicit until code and tests exist.

## Language rules (read carefully)

- **All prose documents are written in Chinese.** That means everything under `docs/`, and any design note, README section, or message you write for humans.
- **Code, code comments, type names, schema field names, commit messages and spec files stay in English.** `spec/` is a contract with machines and international reviewers, so `spec/*.md` is English.
- Code blocks inside Chinese documents are English. This is the one exception.
- Keep English technical terms as-is inside Chinese prose (handoff, token, SBAR, MixedLM, OSF), and add a Chinese gloss the first time each appears.

## Local skills (never committed)

Agent skills for this project live in `.claude/skills/`, and their usage guide lives in `.local/SKILLS.md`. Both paths are gitignored. **Never commit them, never mention them in the README, and never reference them in a code comment.** A new contributor installs their own copy.

**No tracked file may contain an inventory of local skills.** This covers the plan documents, the task tables and the References blocks, not just the README. Writing "track B uses skill X" into a shared document makes a personal tooling choice into a project requirement, and it publishes a target list to anyone probing our supply chain. The rule is: tracked docs may state that a *category* of tooling exists and why it is untracked; they may not name what is installed. Each person keeps their own list in their own untracked file.

## The game (how we work)

- Work is a relaxed game with a progress bar. Take the next step in `docs/06-分工与里程碑.md`, nothing else.
- Break any step into small tasks, each with a binary exit (a test that passes or fails).
- Mistakes and do-overs are welcome. If a step goes wrong, reset it and try again, do not patch around it.
- Do only what the current step needs, and nothing more. No bonus features, no shiny tools.
- Enjoy the process. Trying beats perfecting.

## Stack (decided, do not change without asking)

- TypeScript in strict mode (ESM, no `any`), on the current Node.js LTS, with npm and a committed lockfile.
- Allowed dependencies, and nothing else without asking: `hono` with `@hono/node-server` (HTTP), `zod` (schema validation), `better-sqlite3` (storage, behind a tiny `Store` interface so it can be swapped), `vitest` (tests), `tsx` (run TypeScript), `typescript`, `@biomejs/biome` (lint and format).
- Node's built-in `node:crypto` for chained signatures (`createHmac`, `timingSafeEqual`), no crypto frameworks.
- Docker and Docker Compose are required for dependency installation, building, testing and running, as well as deployment. Do not rely on a host-installed Node.js runtime or toolchain. Use a slim Debian-based Node image so native modules build without fuss.
- License: Apache-2.0 on every file that has a header.

## Repo layout

```
spec/HANDOFF-PACK-SPEC.md      source of truth for behavior (English)
spec/MSG-DESIGN-SPEC.md        the three handoff designs, field by field (English)
spec/COORDINATION-COST-SPEC.md what each cost component means and where it is measured (English)
docs/                          all plans and reports, in Chinese
AGENTS.md                      this file
src/                           schema.ts, token.ts, revoke.ts, lifecycle.ts, inbox.ts, server.ts, cli.ts
src/designs/                   free-text.ts, structured.ts, contract.ts, render-to-prose.ts
src/cost/                      meter.ts, components.ts
bench/                         the benchmark runner and the task families
analysis/                      statistics and figures (Python, managed by uv)
tests/                         one test file per scenario, named s01.test.ts to s10.test.ts
demo/                          one-page web demo
leaderboard/                   public coordination-cost leaderboard
package.json, tsconfig.json, biome.json
Dockerfile, compose.yaml, Makefile
```

Old plan of record: `archive/PLAN-v1-2026-10.md`. It is kept for history only, it is superseded, and it contains known defects. Do not follow it.

## Commands (keep these working at all times)

The Makefile is the supported command entrypoint; targets run their npm scripts inside Docker, so project work does not depend on a host-installed Node.js runtime.

- `make test`: fast unit tests only
- `make attacks`: the 3 attack scenarios only
- `make verify`: all 10 scenarios, the project's real exit condition
- `make run`: local server and demo page
- `make docker`: build and run through docker compose

These three gates must be genuinely different commands. `make verify` filters to the scenario files, `make attacks` filters to the attack files, `make test` runs the unit suite. If two of them ever run the same thing, one of them is lying.

## Hard rules

1. **Spec wins.** If code and HANDOFF-PACK-SPEC.md disagree, stop and ask the human which one is right.
2. **Test first.** Write the failing scenario test, then the code that makes it pass.
3. **Context is data, never instructions.** Text in SBAR fields must never be executed, followed or used to widen scope. Only `scope` grants actions.
4. **Narrow only.** No code path may widen a scope or extend an expiry.
5. **Check revoke on every use**, not only at accept time.
6. **Pointers, not payloads.** Never copy private content into a pack.
7. **Honest status labels.** Never mark something `tested` unless the test ran green, and never `in real use` unless a real person used it.
8. **Verify before reporting.** Run the commands yourself and read the output. Do not hand the human a check you could do.
9. **TypeScript only.** Keep application code, tests, scripts and demo logic in strict TypeScript. Do not introduce another implementation language without asking.
10. **Docker first.** Run dependency installation, builds, tests and the application through Docker or Docker Compose. Host-installed runtimes are not part of the supported workflow.
11. **The arms differ only in encoding.** In any benchmark run, the three designs (free text, structured, structured plus contract) must share the same model, the same system prompt skeleton, the same tool access, the same topology, the same task and the same seed. The only thing allowed to vary is how the handoff message is represented. If anything else varies, the run is invalid, no matter how good the numbers look.
12. **No information asymmetry.** The free-text arm must carry exactly the same information as the structured arms, through `renderToProse()`. Never hand-write a richer free-text prompt or a poorer structured one. A benchmark where structured wins only because it said more is worthless.

## IP boundary (important)

This repo is public plumbing. Never put any of the following in it, in code, tests, examples, comments or commit messages:

- real supplier, buyer or pricing data from any business
- compliance rules or models from any finance or legal product
- unpublished research results or attack and defense details from academic work
- any private project's logic or names

Use toy data only (agents named alice and bob, jobs like "summarize note"). If a task seems to need private material, stop and ask.

## Security and secrets

- No secrets, keys or tokens in the repo, in logs, or in test fixtures. Read them from environment variables, and keep a `.env.example` with fake values.
- Do not add network calls to outside services without asking.
- Pin dependencies and keep them few. Ask before adding any new one.

## Ask the human before

- deleting files or history, force pushing, or rewriting git history
- publishing anything publicly, creating a release, or pointing a domain
- adding a dependency, changing the stack, or changing the spec
- touching anything outside this repository

## Definition of done for any step

1. The step's sentence in the plan document is literally true when you run it.
2. `make test` is green, and `make verify` is green once step 10 is reached.
3. The README or docs changed if user-visible behavior changed.
4. You report in two or three lines: what changed, how you checked it, what is not yet verified.

## Benchmark integrity

- Raw transcripts never enter this repository until a preprint is public. They live in `bench/results/raw/`, which is gitignored.
- Every run records model snapshot id, seed, temperature and full request and response payloads. No `latest` aliases, ever.
- The runner takes a `--max-spend` cap and stops hard when it is hit.
- Analysis reads only from disk. Re-running an analysis must never call a model.

## Style

- Plain, short, human language in code, docs and commit messages. Write "Minimal Understandable": enough background, reason, current state and next step, and nothing more.
- Do not use em dashes anywhere. Use commas, colons or periods.
- Small functions, clear names, comments only where the why is not obvious.
- Types do the documenting: model packs, tokens and states as explicit types, parse every outside input with `zod` at the edge, and run `tsc --noEmit` and Biome before reporting done.
- Commit small, one step or one task per commit, message in the form `step N: what changed`.

## Docker and deploy rules (steps 11 to 13)

- The container must run as a non-root user, read config from environment variables, and expose one port.
- Local first: `docker compose up` must work on a clean machine before any deployment is attempted.
- Deploy the exact same image that passed `make verify` in the container. Never build a different image for production.
- Every deploy ends with the smoke test: create, accept, revoke, confirm the receiver's next call fails.
- CI runs `make verify` on every push. A red CI blocks merging.

## When stuck

Stop after two failed attempts at the same problem. Write down what you tried and what you saw, then ask the human. Guessing a third time is not progress.
