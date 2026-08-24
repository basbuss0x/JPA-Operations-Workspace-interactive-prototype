# Codex Dispatch — Pass 1

Use this prompt to start the first implementation pass.

---

You are implementing the JPA Operations Workspace interactive prototype.

Before writing code:

1. Read `AGENTS.md`.
2. Read every file under `docs/prototype/`.
3. Treat the repository documentation as the source of truth for this pass.

Do not implement the whole product.

For this pass implement only:

- TASK 00 — Prototype Foundation
- TASK 01 — App Shell + Design System
- TASK 02 — Demo Domain + State Engine
- TASK 03 — Home / Work Queue
- TASK 04 — Orders Explorer
- TASK 05 — Order Workspace

Then STOP at Review Gate 1.

## Product intent

This is not a dashboard-design exercise.

The prototype is an operational workspace for managing school procurement orders from ARKAS through HET validation, SIPLah purchasing, vendor procurement, goods arrival, school distribution, payment, school benefit, and completion.

Prefer executable workflows over passive status displays.

The Home page should primarily answer:

> Apa yang harus gue kerjakan sekarang?

The Orders experience should answer:

> Sekolah ini sekarang gimana, apa yang sudah beres, apa yang masih kurang, dan apa next action-nya?

Pipeline is secondary and is not part of this first implementation pass beyond whatever route/shell placeholder is needed for navigation consistency.

## Important architecture rules

- Do not represent the whole workflow with one giant status enum.
- HET, SIPLah, vendor, fulfillment, school payment, benefit, supplier payment, and broad lifecycle must remain independently representable.
- Derive Next Action from domain state where possible.
- Preserve a manual override/snooze model even if the first UI is lightweight.
- Demo actions must mutate actual prototype state.
- Persist prototype state in localStorage.
- Provide Reset Demo Data.
- Use realistic intermediate states.
- Do not implement magic state jumps.

Examples of prohibited simplification:

- `HET mismatch → click Kerjakan → HET approved` without reviewing exceptions.
- `Create Vendor Batch → automatically Sent to Vendor`.
- `School payment LUNAS → automatically Benefit PAID`.

TASK 06+ will implement the deeper workflows later; Pass 1 should model enough state that those slices can be added without redesigning the domain.

## Demo data

Implement the canonical scenarios defined in `DEMO-DATA.md`.

At minimum the running app must visibly contain orders representing:

- HET mismatch
- ready for SIPLah
- SIPLah complete / vendor eligible
- vendor processing
- goods arrived
- partial distribution
- school LUNAS with benefit eligible
- fully completed/closed reference

## Visual/product direction

Follow `UX-RULES.md`.

Aim for:

- calm
- compact
- operational
- responsive
- high scannability

Avoid:

- giant KPI dashboard blocks
- excessive cards
- gradients/glow/glassmorphism
- generic SaaS marketing aesthetic
- decorative analytics
- unrelated features

## Implementation approach

If the repository is still empty except documentation, initialize the prototype with:

- React
- TypeScript
- Vite
- React Router
- Zustand or similarly small client-side store

You may add a lightweight component approach/library only if it materially improves speed and consistency without turning the prototype into a dependency showcase.

Keep domain logic separate from page components.

Implement routes for the first-pass experiences and safe placeholders for later top-level navigation only where necessary.

## Required checks before finishing

1. Run typecheck.
2. Run lint/tests that exist or that you reasonably add for critical domain logic.
3. Run production build.
4. Inspect implemented routes manually in the running app.
5. Verify state mutation.
6. Verify refresh persistence.
7. Verify Reset Demo Data.
8. Verify desktop and mobile layouts.

Add focused domain tests for at least:

- benefit amount/eligibility
- vendor eligibility selector
- Next Action derivation for the canonical Pass 1 scenarios

## End-of-pass report

Report:

- files changed
- routes implemented
- reusable UI primitives
- domain/state model created
- how Next Action is derived
- how local persistence/reset works
- checks run and their results
- assumptions made
- known prototype limitations
- product questions discovered while implementing
- which later task cards were intentionally deferred

Do not begin TASK 06 or later.

---

Expected outcome of this pass:

A coherent, interactive product shell that already feels like an operations workspace and is strong enough for product review before deeper ARKAS/HET/SIPLah and Vendor workflows are implemented.
