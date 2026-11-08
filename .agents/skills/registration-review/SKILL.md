---
name: registration-review
description: Review study reservation changes for capacity, idempotent retries, deadlines, authentication, and database permissions. Use when changing or reviewing registration behavior in this repository.
---

# Reservation review

Read `docs/registration.md` and the root `AGENTS.md`. Trace one request from the Next BFF to `RegistrationService`, `StudyRepository` and the PostgreSQL constraint.

1. Identify the changed public contract and the smallest failing behavioral test. Ask about unresolved product policy before inventing it.
2. Check that the session lock precedes the existing-registration lookup, deadline evaluation and capacity count. An existing registration must survive a retry after closing.
3. Keep identity in the verified JWT `sub`. Require expiry, issuer, audience, signature and write scope. Keep bearer tokens out of the browser session JSON; mutations require the configured Origin.
4. Check runtime DB grants using the actual `study_app` role. Row locking requires `UPDATE(id)`; policy columns, DELETE and DDL remain denied.
5. Run the nearest tests, then `./dev verify`. Use `./dev defect-demo` to observe the deliberately unsafe SQL counterexample. Never weaken an assertion to make it pass.
6. Report findings with source paths, executed commands and observed results. Update `docs/slides-map.json` and teaching materials when the teaching contract changes.

A skill supplies a procedure. It grants no permission to deploy, publish, commit, read secrets, or alter production.
