# UX Rules — JPA Operations Workspace Prototype

## Product UX principle

This is an operations workspace, not a decorative dashboard.

The primary UI question is:

> What can the operator understand or complete from this screen without having to remember, copy, or navigate elsewhere?

## Home hierarchy

Home should prioritize:

1. `Kerjakan Sekarang`
2. active orders/context
3. productivity shortcuts / batch opportunities
4. lightweight counts only when they support action

Do not lead with large KPI cards, charts, finance summaries, or generic SaaS dashboard widgets.

## Work Queue

A work item must communicate:

- what needs to happen
- which school/order it belongs to
- why it matters / what blocks progress
- the direct action

Good:

```text
Review 2 HET exceptions
SDN 30 · Blocker sebelum SIPLah
[Review]
```

Weak:

```text
HET: Warning
```

Where useful, support:

- Do now
- Open context
- Snooze
- Due/reminder date

## Exception-first design

When the system can automatically handle the normal case, show exceptions first.

Example HET review:

```text
28 items detected
26 matched automatically ✓
2 need review
```

The operator should not be forced to manually re-check 26 successful items before seeing the 2 real problems.

## Executable UI

Prefer actions that complete meaningful work from the current context.

Examples:

- resolve an HET match
- mark SIPLah checklist checkpoint complete
- generate vendor recap
- mark batch sent
- record goods arrival
- record school payment
- record benefit payment
- add note/reminder

Avoid cards whose only action is repeatedly `View details` when the user could safely complete the work directly.

## No magic completion

A button labelled `Kerjakan` must not silently jump several real-world steps.

Examples:

Wrong:

```text
HET mismatch
[Kerjakan]
→ HET automatically becomes Approved
```

Correct:

```text
[Review 2 Exceptions]
→ inspect mismatch
→ accept/change/override
→ confirm HET review
```

Similarly:

```text
Create Vendor Batch
```

must not imply:

```text
Sent to Vendor
```

## Order Workspace

An order page should answer within ~10 seconds:

1. What happened?
2. What is currently wrong/missing?
3. What should I do next?

The most prominent element should be the current `Next Action` or important exception, not a large stage title.

Recommended tabs/sections:

- Overview
- ARKAS & HET
- SIPLah
- Vendor
- Barang & Distribusi
- Pembayaran
- Timeline

## Pipeline

Pipeline is an alternate operational overview, not the homepage.

Its job is to answer:

> Banyak order mandek di mana?

Pipeline cards should remain compact and show:

- school
- important warning/exception
- next action

Do not overload each card with every financial and document state.

## Vendor Batch UX

Vendor Batch is an execution workspace.

Flow should be visible:

```text
Eligible Orders
→ Select schools
→ Aggregate items
→ Review school breakdown
→ Generate recap
→ Mark sent
→ Vendor confirmed/processes
→ Record arrival
```

The user must be able to distinguish batch lifecycle states at a glance.

## SIPLah UX

Treat SIPLah as a checklist of real operational steps, not one `Complete/Incomplete` status.

Example:

```text
✓ Access available
✓ Order placed in JPA/TokoLadang
  Order number: ...
✓ Surat Pesanan available
○ Surat Pesanan sent to school
```

Do not expose or request the school's real password in the prototype.

## Finance UX

Keep finance operational and lightweight.

School payment:

```text
Invoice amount
UNPAID / LUNAS
Record payment
```

Benefit:

```text
10% derived amount
NOT ELIGIBLE / ELIGIBLE / PAID
Record benefit payment
```

Supplier payment can show obligation/paid/outstanding context but should not turn this prototype into accounting software.

## Visual direction

Aim for:

- calm
- compact
- high information clarity
- operational density
- obvious hierarchy
- strong scannability
- responsive desktop/mobile

Avoid:

- gradients for decoration
- glassmorphism
- glowing cards
- giant rounded tiles everywhere
- oversized dashboard numbers
- excessive status colors
- fake marketing illustrations
- animation that slows task execution

Use color primarily for meaning: warning, blocking issue, success, selected/current state.

## Mobile

Do not simply shrink the desktop layout.

Mobile priorities:

- capture/upload ARKAS
- see next actions
- open an order
- record goods arrival
- record payment/benefit
- add note/reminder

Touch targets must be comfortable and core actions should not require horizontal table scrolling whenever a card/list alternative is practical.

## Copy style

Use direct operational Bahasa Indonesia. English domain/technical terms are acceptable when they are already natural in the workflow.

Prefer:

- `Kerjakan Sekarang`
- `Review Selisih HET`
- `Siap Masuk Rekap Vendor`
- `Barang Sudah Tiba`
- `Belum Dibayar`
- `Benefit Siap Dibayar`

Avoid unnecessarily corporate/jargon-heavy terms such as `Settlement` when `Penyelesaian` or `Pembayaran & Selesai` is clearer.

## Prototype evaluation rule

Do not judge a screen primarily by visual polish.

Judge it by:

- time to understand next action
- number of manual steps removed
- duplicate-entry reduction
- ability to handle many schools without memory overload
- clarity of intermediate states
- ease of recovering context after not touching an order for days/weeks
