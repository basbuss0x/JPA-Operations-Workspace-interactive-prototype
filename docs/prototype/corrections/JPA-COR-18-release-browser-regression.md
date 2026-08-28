# JPA-COR-18 - Full Browser Regression and Field-Test Gate

Phase: 3 - release proof  
Priority: mandatory release gate  
Blocked by: #7-#17  
Scope: all 15 canonical audit flows, desktop, 390 px, persistence, and workbook artifact

## Outcome

The implemented graph is compared with the intended graph through interactive use of the running application. The result is an evidence-backed field-test recommendation, a precise blocker list, or a rollback request. Source review or passing automated tests alone cannot close this card.

## Preconditions

- Decisions #1-#6 are recorded.
- Review Gates A and B passed.
- Each implementation card returned checks, browser evidence, residual risks, and rollback note.
- Repository state and intended comparison baseline are known.

## Required route/flow matrix

| Flow | Happy path | Required variants | Desktop | 390 px |
|---|---|---|---:|---:|
| Home / Work Queue | do, snooze, manual/system coexistence | empty, scheduled, due, overdue | yes | yes |
| New Order / ARKAS | select/create, extract, create | no school, inactive, duplicate, missing file | yes | yes |
| HET | resolve and approve | mismatch, alternatives, override, reopen | yes | yes |
| SIPLah | Vendor-ready | blocked Surat Pesanan, admin later | yes | yes |
| Vendor Builder | select/aggregate/create | empty and invalid selection | yes | smoke |
| Vendor Detail | recap through processing/arrival | no reminder, due, save error, partial arrival | yes | yes |
| XLSX | generate and inspect | metadata/labels and not-sent state | artifact | artifact |
| Distribution | check/refresh/accept | stale, error, conflict, partial | yes | yes |
| Payment | reminder and LUNAS | invalid date, mismatch, save failure | yes | yes |
| Benefit | CASH and TRANSFER | missing conditional reference | yes | yes |
| Parallel obligations | primary/secondary/snooze | each concern independently snoozed | yes | yes |
| Completion / Closed | review/confirm | blocked, repeated submit, recovery policy | yes | yes |
| Timeline | recover context | long history, closed/reopened/conflict | yes | yes |
| Pipeline | scan and open | later stages, empty stages, closed toggle | yes | yes |
| Mobile operator mode | core field tasks | long labels, safe area, keyboard/modal | n/a | yes |

## Verification procedure

1. Record commit, branch, dirty state, browser, viewport, and current date/time assumptions.
2. Reset demo data and verify canonical fixture count/identity.
3. Run the original audit flows interactively, not just the new E2E test.
4. For each corrected card, exercise happy, empty, invalid, error, denied/closed, refresh, and long-content states that apply.
5. Verify persistence with hard refresh and route revisit after each state mutation that should survive.
6. Verify Home and Timeline after every consequential transition.
7. Inspect keyboard focus, Escape behavior, tab order, error announcements, and CTA reachability.
8. Repeat the mobile matrix at approximately 390 × 844; do not merely check for overflow.
9. Generate the canonical Vendor workbook, open/render both sheets, and reconcile every total against the UI.
10. Compare each intended `Job -> Flow -> Surface<C,V,N>` against actual behavior. Record omitted, added, or changed graph nodes.
11. Capture evidence with route/state/viewport names. Screenshots support observations but do not replace interaction notes.
12. Run the complete automated suite after browser testing to detect state/test drift.

## Release blockers

- Any `UNPAID` or Vendor `PROCESSING` wait is silently actionless.
- Valid reminder save fails, duplicates, or loses state.
- Closure occurs without review or generates duplicate mutation/events.
- New Order can advance with implicit, inactive, duplicate, or stale school context.
- Payment/benefit/later stages remain undiscoverable at supported viewports.
- Native English validation controls a critical flow.
- Raw implementation terminology remains in an audited critical surface without approved exception.
- Tracker stale/error/conflict overwrites last known good data.
- Workbook totals/allocations differ from UI or generation marks the batch sent.
- Any invariant in `JPA-CORRECTION-MAP.md` regresses.
- Reset Demo Data or local persistence is broken.
- Typecheck, lint, tests, build, or required E2E suite fails because of the correction work.

## Required deliverable

Create a dated regression report containing:

- final verdict: ready for field test / blocked;
- commit and environment;
- ticket-by-ticket pass/fail table;
- 15-flow matrix results;
- automated check results;
- screenshot and workbook evidence inventory;
- intended-vs-implemented graph deviations;
- pre-existing versus introduced failures;
- remaining P2/P3 items and explicitly deferred field-test questions;
- exact rollback recommendation for any failed release unit.

## Automated checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

## Done definition

This card is done only when every release blocker is absent and the interactive evidence supports the result. A green automated suite without browser completion is incomplete. If blocked, do not patch unrelated defects inside this card; route them back to the owning ticket.
