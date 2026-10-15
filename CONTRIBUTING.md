# Contributing to Handoff Pack

Thanks for your interest in Handoff Pack. This project is built on
trust, clear IP terms, and small, honest steps. Please read this
document before opening an issue or pull request.

The project is licensed under the Apache License 2.0 (see
[`LICENSE`](./LICENSE)). By submitting a contribution, you agree to
license your work under Apache-2.0. There is no separate Contributor
License Agreement, no sign-off, and no paperwork — Apache-2.0 covers
the patent grant (Section 3) on its own.

## 1. Start by reading the project

- `spec/HANDOFF-PACK-SPEC.md` — the source of truth for behavior.
- `docs/PLAN.md` — the buildable task list.
- `AGENTS.md` — rules every AI coder follows in this repo, including
  the IP-boundary rule (no private material, toy data only).

## 2. Make changes

- Work in a feature branch off `main`.
- One step or one logical change per commit. Commit messages in the
  form `step N: what changed` (see `docs/PLAN.md`).
- Run `make test` locally before opening a PR. New behavior must come
  with a test (`tests/sNN.test.ts`).
- Follow the existing code style: TypeScript strict ESM, `biome`
  formatted, no `any`, small functions, types do the documenting.

## 3. IP boundary

You may not contribute code, text, data, or ideas that originate from
a private project, an unpublished research artifact, a third party's
proprietary codebase, or any other source where you do not have the
right to license under Apache-2.0. See `AGENTS.md` for the full
IP-boundary rule. If you are unsure, stop and ask.

## 4. AI-assisted contributions

Code, text, or designs produced with help from an AI coding assistant
is welcome and treated as your own contribution, provided you
understand and can defend it, and it does not introduce material from
a restricted source. Disclose AI assistance in the PR description when
the contribution is non-trivial.

## 5. Reporting problems

- Bugs and feature requests: open a GitHub issue with a minimal
  reproduction.
- Security issues: do not open a public issue. Contact
  `jason.you1995@gmail.com` privately.
- Code of Conduct concerns: see `CODE_OF_CONDUCT.md`.

## 6. Community expectations

All participants are expected to follow `CODE_OF_CONDUCT.md`. Be
specific, be kind, do the work.

---

By contributing, you confirm that your contribution is your own
original work or properly attributed to its source, that you have
the right to license it under Apache-2.0, and that it does not
introduce material from a restricted source.
