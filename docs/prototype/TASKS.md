# Prototype Task Cards

This file is the implementation queue for the JPA Operations Workspace interactive prototype.

Do not implement all cards in one uncontrolled pass. Follow the dependency order and stop at review gates.

## Build phases

### Pass 1 — Product shell
Implement TASK 00–05 only, then stop for product review.

### Pass 2 — ARKAS → HET → SIPLah vertical slice
Implement TASK 06–08 only after Pass 1 is approved.

### Pass 3 — Vendor productivity vertical slice
Implement TASK 09–10.

### Pass 4 — Fulfillment + financial completion
Implement TASK 11–12, then harden TASK 14–15.

### Pass 5 — Alternate views, mobile, full QA
Implement TASK 13, 16, 17.

---

# TASK 00 — Prototype Foundation

**Slug:** `prototype-foundation`

## Goal
Initialize the frontend prototype with a maintainable structure and development quality gates.

## Build
- React + TypeScript + Vite unless the repository already has another accepted stack.
- React Router.
- Small client state store such as Zustand.
- localStorage persistence layer with versioned demo state.
- Reset Demo Data mechanism.
- lint/typecheck/build scripts.
- domain logic separated from page rendering.

Suggested source structure is defined in `ARCHITECTURE.md`.

## Acceptance criteria
- app runs locally
- routes can be added cleanly
- TypeScript strict mode enabled
- canonical demo state can be loaded/reset
- refresh preserves state
- lint/typecheck/build are green

---

# TASK 01 — App Shell + Design System

**Slug:** `app-shell-design-system`

## Goal
Create the shared operational application shell and reusable UI primitives.

## Routes/navigation
Primary navigation:
- Home
- Pesanan
- Pipeline
- Vendor

Desktop uses sidebar/header. Mobile uses an appropriate compact navigation pattern.

## Reusable primitives
At minimum:
- AppShell
- PageHeader
- Button variants
- StatusChip
- Warning/Exception indicator
- NextAction card/row
- Order summary card/row
- EmptyState
- Modal/Drawer
- Tabs
- simple forms

## UX requirements
Follow `UX-RULES.md`.
Avoid decorative SaaS-dashboard styling.

## Acceptance criteria
- desktop shell usable
- mobile shell usable
- primitives reused by subsequent screens
- clear focus/hover/disabled states
- visual hierarchy supports operational scanning

---

# TASK 02 — Demo Domain + State Engine

**Slug:** `prototype-state-engine`

## Goal
Make the prototype behave like a system instead of a collection of static screens.

## Build
Implement typed domain models and canonical scenarios from `DEMO-DATA.md`.

Support state transitions for:
- HET review
- SIPLah checkpoints
- vendor batching/lifecycle
- goods arrival
- school payment
- benefit eligibility/payment
- next-action override/snooze metadata
- timeline event creation

Use derived selectors for:
- work queue
- next action
- HET exception count
- vendor batch eligibility
- vendor aggregation
- benefit amount/eligibility
- completion readiness
- pipeline grouping

## Acceptance criteria
- actions mutate state
- state survives refresh
- reset restores canonical demo data
- realistic intermediate states remain representable
- no giant status enum controls unrelated domains

---

# TASK 03 — Home / Work Queue

**Slug:** `home-work-queue`

**Route:** `/`

## Primary question
`Apa yang harus gue kerjakan sekarang?`

## Build
Top section: `Kerjakan Sekarang`.

Work items should include realistic examples:
- Review HET exceptions
- Complete SIPLah purchase
- orders ready for Vendor Batch
- goods arrived and need checking
- school payment/benefit action

Each task communicates:
- action
- school/order context
- why it matters
- direct CTA

Support where useful:
- Open context
- Snooze
- Due/reminder date

Below the queue show compact `Pesanan Aktif` context.

Do not make KPI cards the visual center of the page.

## Acceptance criteria
- next important work is understandable within ~5 seconds
- CTA opens the correct workflow/context
- queue is derived from domain state
- completing a workflow changes the queue
- snoozed item leaves the immediate queue and can return later in simulated time/date handling

---

# TASK 04 — Orders Explorer

**Slug:** `orders-explorer`

**Route:** `/orders`

## Goal
Answer: `Sekolah X sekarang gimana?`

## Build
Search by at least:
- school
- internal order ID
- SIPLah reference
- ARKAS reference

Quick filters:
- Needs Action
- HET Problem
- Ready SIPLah
- Ready Vendor
- Goods Arrived
- Unpaid
- Benefit Eligible

Rows/cards show:
- school
- lifecycle position
- important exception
- next action
- HET
- SIPLah
- vendor
- goods/fulfillment
- payment
- benefit

## Acceptance criteria
- filtering/search work on demo data
- mobile does not depend on a huge horizontal table
- selecting an order navigates to its workspace

---

# TASK 05 — Order Workspace

**Slug:** `order-workspace`

**Route:** `/orders/:orderId`

## Goal
Within ~10 seconds answer:
1. What happened?
2. What is missing/wrong?
3. What should happen next?

## Build
Header:
- school name
- internal order ID
- broad lifecycle position
- prominent Next Action / exception

Sections/tabs:
- Overview
- ARKAS & HET
- SIPLah
- Vendor
- Barang & Distribusi
- Pembayaran
- Timeline

Overview should emphasize exceptions/readiness rather than dumping every field.

Example summary:
- HET matched
- SIPLah procurement-ready / admin state visible
- Vendor goods arrived
- Fulfillment 79% — remaining 67
- School payment LUNAS
- Benefit ELIGIBLE

## Acceptance criteria
- all canonical demo orders open correctly
- independent state dimensions remain visible
- direct actions go to the appropriate focused workflow
- no magic generic `Kerjakan` button that skips required review steps

---

# REVIEW GATE 1

Stop implementation after TASK 05.

Before proceeding, report:
- implemented routes
- domain/state model
- screenshots or concise route walkthrough
- assumptions
- known limitations
- lint/typecheck/build results

Do not start TASK 06+ until explicitly asked.

---

# TASK 06 — New Order Intake

**Slug:** `new-order-intake`

**Route:** `/orders/new`

## Goal
Prototype the path from ARKAS source to a structured draft order.

## Flow
1. choose/create school
2. upload simulated PDF/photo or choose demo document
3. extraction simulation
4. extracted line-item review
5. HET matching simulation
6. route to HET exception review
7. confirm order only after review gate

## Acceptance criteria
- fake source document can produce structured order lines
- extraction can include imperfect/ambiguous results
- user reviews before order confirmation
- no real OCR service required

---

# TASK 07 — HET Exception Review

**Slug:** `het-exception-review`

**Route:** `/orders/:orderId/arkas`

## Goal
Test exception-first HET checking as a replacement for manually reviewing every line in Excel.

## Build
Summary example:
- 28 detected
- 26 matched automatically
- 2 need review

Exception types:
- price mismatch
- ambiguous product match
- no confident match

Actions:
- Accept Match
- Choose Different Product
- Search Product Master
- Manual Override with reason

Footer summary:
- ARKAS total
- HET total
- difference

## Acceptance criteria
- successful lines do not dominate the screen
- every exception can be resolved
- final HET approval requires explicit confirmation
- resolving exceptions changes next action to SIPLah

---

# TASK 08 — SIPLah Operational Workflow

**Slug:** `siplah-operations`

**Route:** `/orders/:orderId/siplah`

## Goal
Represent the real SIPLah workflow as checkpoints instead of a single boolean.

## Checkpoints
1. access available
2. order placed in JPA/TokoLadang
3. explicit final SIPLah transaction amount confirmed and order number recorded
4. Surat Pesanan available/attached
5. Surat Pesanan verified and sent to school
6. Invoice, Kwitansi, and BAST admin completion later where appropriate

Never request/store a real school password.

## Acceptance criteria
- each checkpoint can be independently incomplete
- UI clearly shows where process stopped
- HET approval sets reviewed HET only; final SIPLah amount is recorded during ordering
- completing Surat Pesanan procurement checkpoints makes the order Vendor Batch eligible
- Invoice/Kwitansi/BAST do not block Vendor readiness
- admin completion remains separately derived

---

# REVIEW GATE 2

Stop and review the full vertical slice:

`ARKAS → HET exceptions → approval → SIPLah → vendor eligibility`

---

# TASK 09 — Vendor Batch Builder

**Slug:** `vendor-batch-builder`

**Route:** `/vendor-batches/new`

## Goal
Replace manual cross-school vendor recap work.

## Flow
1. show eligible orders only
2. select schools/orders
3. derive aggregate product quantities
4. preserve school-by-school breakdown
5. preview recap
6. generate `.xlsx` client-side
7. create batch in DRAFT/RECAP_GENERATED state

## Excel prototype
At least:
- Summary/Aggregate sheet
- School Breakdown sheet
- batch ID/date
- product title/code when available
- total qty

## Acceptance criteria
- aggregation is derived, never retyped
- selecting/unselecting orders recalculates totals
- export produces a usable workbook
- creating/generating a batch does not mean it was sent

---

# TASK 10 — Vendor Batch Lifecycle

**Slug:** `vendor-batch-lifecycle`

**Routes:**
- `/vendor-batches`
- `/vendor-batches/:batchId`

## Lifecycle
- DRAFT
- RECAP_GENERATED
- SENT_TO_VENDOR
- VENDOR_CONFIRMED
- PROCESSING
- PARTIALLY_ARRIVED
- ARRIVED

## Actions
- Generate/regenerate recap
- Mark sent
- Mark vendor confirmed
- Start processing
- Record partial/full arrival

## Acceptance criteria
- lifecycle transitions are explicit
- batch membership visible
- aggregate + school breakdown visible
- order context reflects relevant batch state

---

# REVIEW GATE 3

Validate whether Vendor Batch genuinely reduces manual recap work.

---

# TASK 11 — Goods Arrival + Distribution

**Slug:** `goods-distribution`

## Goal
Track vendor arrival and hand off detailed fulfillment to the existing tracker.

## Build
Record:
- arrival date
- batch/order
- partial/full arrival
- notes
- goods checked/ready to deliver

Mock external fulfillment summary:
- ordered
- delivered
- remaining
- progress
- problems
- last updated/sync state

Provide `Open Kelengkapan Tracker` affordance as a simulated external link/action.

## Acceptance criteria
- detailed book reconciliation is not duplicated
- summary is enough to understand current operational state
- arrival can generate a next action such as check/schedule delivery

---

# TASK 12 — School Payment + Benefit

**Slug:** `payment-benefit`

## Goal
Prevent payment/benefit obligations from being forgotten without building accounting software.

## School payment
Store/simulate:
- invoice amount
- UNPAID / LUNAS
- amount
- date
- method
- evidence metadata

## Benefit
Derived amount = final invoice × 10%.

States:
- NOT_ELIGIBLE
- ELIGIBLE
- PAID

When school becomes LUNAS, benefit becomes ELIGIBLE automatically unless already PAID.

Benefit record can capture:
- date
- method
- recipient type/name
- amount
- proof metadata
- school confirmation checkbox

## Acceptance criteria
- LUNAS immediately creates correct eligible benefit action
- benefit amount uses full final invoice/ARKAS amount
- supplier outstanding state does not block company-level completion

---

# TASK 13 — Pipeline Overview

**Slug:** `pipeline-overview`

**Route:** `/pipeline`

## Goal
Detect cross-order bottlenecks.

Columns:
- Intake
- HET
- SIPLah
- Vendor
- Barang Tiba
- Distribusi
- Penyelesaian

Cards remain compact:
- school
- important exception
- next action

## Acceptance criteria
- grouping is derived from lifecycle stage
- clicking card opens order
- pipeline remains secondary to Home

---

# TASK 14 — Next Action Engine

**Slug:** `next-action-engine`

## Goal
Make every active order answer `what should happen next?`

## Suggested rule order
- unresolved HET exception
- HET approved but SIPLah procurement incomplete
- SIPLah procurement-ready but not vendor batched
- vendor arrival requires goods check
- distribution/fulfillment requires action
- scheduled school payment follow-up
- school LUNAS + benefit ELIGIBLE
- completion/close

Support:
- system suggestion
- manual override
- snooze until date
- due/reminder metadata

## Acceptance criteria
- deterministic domain tests cover important rules
- manual override does not corrupt underlying state
- completing an action recomputes the next action

---

# TASK 15 — Timeline / Context Recovery

**Slug:** `order-timeline`

## Goal
Make an old order understandable without relying on memory/chat history.

## Automatic events
Examples:
- ARKAS uploaded
- HET approved
- SIPLah order placed
- Surat Pesanan sent
- Added to Vendor Batch
- Batch sent/confirmed
- Goods arrived
- Fulfillment update
- School LUNAS
- Benefit paid
- Order closed

Manual:
- Add Note
- optionally create reminder from note

## Acceptance criteria
- important state transitions append timeline events
- manual notes persist
- timeline clearly distinguishes system events vs notes

---

# TASK 16 — Mobile Operations

**Slug:** `mobile-operations`

## Goal
Make the prototype usable while visiting a school/vendor.

Prioritize:
- capture/upload ARKAS
- next actions
- order lookup
- goods arrival
- payment/benefit recording
- quick note/reminder

## Acceptance criteria
- no critical flow requires desktop-only interaction
- touch targets usable
- avoid forcing huge table scrolling where cards/lists are better

---

# TASK 17 — Demo Journey + QA

**Slug:** `prototype-demo-scenarios`

## End-to-end scenarios

### A — New school
`New Order → ARKAS → HET exceptions → resolve → confirm reviewed HET → SIPLah access → place order → confirm final SIPLah amount → record order number → complete Surat Pesanan → Vendor eligible; Invoice/Kwitansi/BAST remain later`

### B — Vendor productivity
`select multiple eligible schools → aggregate → preview → generate Excel → mark sent → vendor processing`

### C — Fulfillment
`record goods arrival → check goods → Distribution → fulfillment summary visible`

### D — Finance
`UNPAID → record LUNAS → benefit ELIGIBLE → pay benefit → PAID`

### E — Context recovery
Open a partially completed order and identify within ~10 seconds:
- what happened
- what remains
- next action

## Final checks
- typecheck
- lint
- unit/domain tests
- build
- route smoke review
- mobile review
- Reset Demo Data works
- local persistence works
- exported vendor workbook opens and has correct totals

## Final prototype report
Include:
- routes
- supported workflows
- domain model summary
- known limitations
- product questions discovered during implementation
- areas that should remain prototype-only vs candidates for production architecture
