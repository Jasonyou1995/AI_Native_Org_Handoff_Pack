# PLAN.md: Handoff Pack, from empty repo to a deployed app

Goal: an open-source, permissioned, revocable agent-to-agent handoff layer (see HANDOFF-PACK-SPEC.md).

How to use this plan: give your AI coder one step at a time, and call a step done only when its sentence is literally true on your machine. Mistakes just reset the step, do-overs are free.

## Part A: Build (steps 1 to 10)

`[█░░░░░░░░░]` **1. Skeleton.** You can clone the repo, run `make test`, and see one placeholder test pass, with the Apache-2.0 license, a README stub, SPEC, PLAN and AGENTS already in place.

`[██░░░░░░░░]` **2. Pack schema.** You can write a pack as a JSON file, validate it from the command line, and see a clear error when `verify` is missing or any SBAR field is over 500 characters.

`[███░░░░░░░]` **3. Token with narrow.** You can mint a signed token for a pack, narrow its scope or expiry, and see any attempt to widen it fail the signature check.

`[████░░░░░░]` **4. Revoke and expiry.** You can revoke a pack or let it expire and see the receiver's very next call fail with a plain reason.

`[█████░░░░░]` **5. Full lifecycle.** You can run create, deliver, accept or decline, act, report and close between two separate toy workspaces from the command line and read each state change in a log.

`[██████░░░░]` **6. Attack suite.** You can run `make attacks` and see three attacks blocked: instructions injected into context, scope widening on re-delegation, and replay after revoke.

`[███████░░░]` **7. Local service.** You can start one local server and run the same lifecycle through its HTTP API, getting JSON replies that carry an honest status label (prototype, tested, in real use, delivered).

`[████████░░]` **8. Inbox adapter.** You can send a pack through a stub inbox and watch a second agent receive it, with the adapter written so the real DSH inbox can replace the stub later.

`[█████████░]` **9. Demo page.** You can open one web page at localhost that shows two agents, the pack between them and a revoke button, and watch the receiver's next call fail live after you press it.

`[██████████]` **10. Verified and documented.** You can run `make verify`, see 10 of 10 scenarios pass, and hand the README to a stranger who can run the demo from it in 3 minutes, which means the app is fully built.

## Part B: Ship and maintain (steps 11 to 13)

`[███████████]` **11. Docker, local first.** You can run `docker compose up` on a clean machine, open the demo page and API on localhost, and run `make verify` inside the container with the same 10 of 10 result.

`[████████████]` **12. Deploy anywhere.** You can push the same image to any container host (Fly.io, Railway, Cloud Run or a plain VPS) with one documented command and open a public URL that behaves exactly like localhost, with every secret coming from environment variables.

`[█████████████]` **13. Maintenance and testing.** You get CI that runs all 10 scenarios on every push, a daily smoke test against the deployed URL, weekly automatic dependency updates, and one alert message whenever any of them fails.

## Status key

Label every step honestly: `prototype`, `tested`, `in real use`, `delivered`. Never round up.
