# JPA-COR-07 - Reminders and Passive Waits

Phase: 1 - field-test blocker  
Priority: P1 - execute first  
Blocked by: decision #1 in `JPA-CORRECTION-MAP.md`  
Findings: UX-001, UX-002, UX-014  
Primary routes: `/`, `/orders/:orderId?tab=finance`, `/vendor-batches/:batchId`

## Outcome

A school payment or vendor wait is never silently dependent on operator memory. Valid reminder dates save reliably, unscheduled waits expose a setup obligation, due reminders create one actionable Home item, and resolved waits remove obsolete reminders without hiding unrelated work.

## Target graph

```text
UNPAID or PROCESSING begins
  -> no confirmed follow-up date
    -> Atur tindak lanjut obligation
      -> operator confirms/edits date
        -> scheduled and persisted
          -> due date reached
            -> follow-up action on Home
              -> reschedule or resolve underlying state

Underlying state resolves
  -> obsolete reminder resolves automatically
    -> unrelated obligations remain
```

## Starting points in the repository

- `src/utils/reminder-date.ts`
- `src/features/finance/finance-workspace.tsx`
- `src/routes/vendor-batch-detail-page.tsx`
- `src/domain/types.ts`
- `src/domain/next-action.ts`
- `src/domain/selectors.ts`
- `src/domain/transitions.ts`
- `src/store/use-prototype-store.ts`
- `src/data/demo-data.ts`
- `src/domain/next-action.test.ts`
- `src/domain/vendor.test.ts`
- `src/domain/fulfillment-finance.test.ts`
- `src/utils/reminder-date.test.ts`
- `tests/e2e/prototype.spec.ts`

Treat this list as a map, not permission to edit every file.

## Implementation requirements

1. Reproduce the valid-date disabled-button defect before changing code, including the actual browser's date-input value behavior.
2. Validate calendar dates at the UI boundary and domain boundary. Reject empty, malformed, impossible, and policy-disallowed past dates with an inline Indonesian message.
3. Preserve local calendar day through timestamp conversion and refresh; do not introduce UTC date drift.
4. Implement the approved decision #1 policy. Recommended shape:
   - existing `FOLLOW_UP_PAYMENT` / `FOLLOW_UP_VENDOR` remain due actions;
   - add explicit schedule/setup action kinds if overloading the due action would make snooze or copy ambiguous;
   - an unscheduled setup obligation is not a stale vendor chase and must not pretend a due date exists.
5. Group one Vendor Batch obligation rather than duplicating it for every member school.
6. Rescheduling updates one logical reminder. Repeated submit/double-click must not create duplicate Timeline events or queue items.
7. Confirming school payment clears its reminder. Full Vendor arrival clears its reminder; partial arrival follows the approved policy.
8. Save failure retains the entered date, exposes retry, and does not report success.
9. Preserve independently actionable and snoozed obligations.
10. If the persisted state shape changes, increment the demo-state version and add a focused migration test. Do not reset compatible user state unnecessarily.

## Explicit non-goals

- No automatic stale threshold without approved real timing evidence.
- No WhatsApp, device notification, email, or calendar integration.
- No generic background scheduler; the prototype can derive due state from persisted dates and current time.
- Do not make `PROCESSING` itself an immediate vendor chase if decision #1 retains the old passive-state rule.

## Acceptance criteria

- [ ] Finance and Vendor **Simpan reminder** enable for a valid future date.
- [ ] Saved dates persist after hard refresh and route revisit.
- [ ] Empty, malformed, impossible, and past dates show specific inline Indonesian errors.
- [ ] `UNPAID` without a date yields exactly one **Atur tindak lanjut pembayaran** obligation.
- [ ] Vendor `PROCESSING` without a date yields exactly one batch-level **Atur tindak lanjut vendor** obligation.
- [ ] A future confirmed date removes the setup obligation and remains non-actionable until due.
- [ ] A due date produces the existing operational follow-up action with correct context.
- [ ] Reschedule changes the existing obligation and Timeline history remains coherent.
- [ ] Repeated submit does not duplicate queue items or Timeline events.
- [ ] Payment `LUNAS` and fully resolved Vendor arrival clear obsolete reminders.
- [ ] Unrelated actions for the same order remain visible.
- [ ] Save failure preserves the field value and provides retry.
- [ ] Desktop and 390 px CTA/error states are visible without horizontal page scrolling.

## Automated verification

Add focused unit/domain coverage for date round-trip, invalid dates, unscheduled setup candidates, future versus due behavior, batch grouping, automatic resolution, duplicate submission, and migration if applicable. Update E2E expectations that currently assert `ORD-2026-049` has no active action.

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

## Mandatory browser verification

1. Reset demo data.
2. Open Finance for an `UNPAID` order with no date and verify setup obligation in workspace and Home.
3. Save a valid date, refresh, revisit, and inspect Timeline/Home.
4. Exercise invalid and save-failure states.
5. Repeat for a Vendor `PROCESSING` batch and verify one grouped obligation.
6. Resolve each underlying wait and verify only obsolete reminders disappear.
7. Repeat critical controls at 390 × 844.

Capture evidence for unscheduled, scheduled, due, invalid, persisted, and resolved states.

## Stop conditions

Stop and return to decision #1 if setup obligations, default dates, snoozing, or partial-arrival reminder behavior are still policy-ambiguous. Do not invent a stale threshold to finish the card.
