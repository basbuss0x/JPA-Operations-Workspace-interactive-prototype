# Codex Instructions — JPA Operations Workspace Prototype

Before writing code, read all files under `docs/prototype/`.

## Source of truth order

1. `docs/prototype/CONTEXT.md` — business/domain truth
2. `docs/prototype/PRODUCT.md` — product scope and success criteria
3. `docs/prototype/ARCHITECTURE.md` — prototype state/route architecture
4. `docs/prototype/UX-RULES.md` — mandatory interaction principles
5. `docs/prototype/DEMO-DATA.md` — canonical demo scenarios
6. `docs/prototype/TASKS.md` — implementation queue and review gates

If implementation pressure conflicts with these docs, do not silently simplify the domain. Preserve realistic intermediate states and report the conflict.

## Product rule

This is NOT a dashboard-design exercise.

Prefer executable workflows over passive status displays.

For every screen ask:

1. What repetitive work does this remove?
2. What decision does this make easier?
3. What information does the operator no longer need to remember?
4. What action can be completed directly here?
5. Can a useful Next Action be derived from state?

## Boundaries

Do not add without explicit instruction:

- accounting system
- CRM
- advanced analytics/BI
- AI chatbot
- complex role management/RBAC
- real SIPLah credential storage
- real OCR/AI integration
- generic SaaS dashboard widgets
- features outside `TASKS.md`

Do not rebuild the detailed Kelengkapan Buku Tracker.

## State rules

Do not model all behavior through one giant status enum.

Keep broad lifecycle, HET, SIPLah, vendor, fulfillment, school payment, benefit, and supplier payment independently representable.

Do not implement magic transitions. Creating a vendor batch is not the same as sending it. A HET mismatch cannot become approved without review. Marking school payment LUNAS may make benefit ELIGIBLE, but must not automatically mark benefit PAID.

## Implementation quality

- TypeScript strict.
- Domain/derived state logic should not live only inside page components.
- Prefer small, clear components over premature abstraction.
- Persist prototype state locally and provide Reset Demo Data.
- Desktop and mobile must both be usable.
- Run available typecheck/lint/tests/build before reporting completion.

## Current execution gate

Unless the user explicitly changes the gate, implement only **TASK 00–05** from `docs/prototype/TASKS.md` for the first pass and STOP after Review Gate 1.

Do not start TASK 06+ automatically.

At the end of a pass report:

- files changed
- routes implemented
- domain/state model
- checks run/results
- assumptions
- known limitations
- product questions discovered
- intentionally deferred task cards
