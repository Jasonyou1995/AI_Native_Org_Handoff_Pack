# AGENTS.md: guide and rules for any AI coder (Claude Code, Codex, Cursor, others)

Read this first, every session. Then read HANDOFF-PACK-SPEC.md and PLAN.md.

## What this project is

An open-source handoff-pack prototype specification for one agent to hand a job to another agent across workspaces, with a scope, an expiry and a revoke handle. The project currently has a specification draft only: no implementation code or verified behavior. Keep that status explicit until code and tests exist.

## The game (how we work)

- Work is a relaxed game with a progress bar. Take the next step in PLAN.md, nothing else.
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
HANDOFF-PACK-SPEC.md   source of truth for behavior
PLAN.md                13 steps, one sentence each
AGENTS.md              this file
src/                   schema.ts, token.ts, revoke.ts, lifecycle.ts, inbox.ts, server.ts, cli.ts
tests/                 one test file per scenario, named s01.test.ts to s10.test.ts
demo/                  one-page web demo
package.json, tsconfig.json, biome.json
Dockerfile, compose.yaml, Makefile
```

## Commands (keep these working at all times)

The Makefile is the supported command entrypoint; targets run their npm scripts inside Docker, so project work does not depend on a host-installed Node.js runtime.

- `make test`: fast unit tests
- `make attacks`: the 3 attack scenarios
- `make verify`: all 10 scenarios, the project's real exit condition
- `make run`: local server and demo page
- `make docker`: build and run through docker compose

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

1. The step's sentence in PLAN.md is literally true when you run it.
2. `make test` is green, and `make verify` is green once step 10 is reached.
3. The README or docs changed if user-visible behavior changed.
4. You report in two or three lines: what changed, how you checked it, what is not yet verified.

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
