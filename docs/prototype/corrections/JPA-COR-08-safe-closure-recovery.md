# JPA-COR-08 - Safe Closure and Recovery

Phase: 1 - field-test blocker  
Priority: P1  
Blocked by: decision #2  
Findings: UX-003, UX-012  
Primary routes: `/orders/:orderId?tab=finance`, closed order workspace and Timeline

## Outcome

Closing an order is a deliberate, auditable transition. The operator reviews blocking and non-blocking prerequisites before confirmation, duplicate submission is harmless, closed-state guidance is accurate, and any approved reopen path requires explicit reason without introducing production RBAC.

## Target graph

```text
Completion state
  -> derive closure checklist
    -> blocked: explain unmet prerequisites
    -> eligible: open review
      -> explicit confirmation
        -> close once
          -> read-only closed workspace + Timeline event
            -> optional approved reopen capability + mandatory reason
```

## Starting points

- `src/features/finance/finance-workspace.tsx`
- `src/components/work-queue/next-action-panel.tsx`
- `src/routes/order-workspace-page.tsx`
- `src/features/orders/order-tab-content.tsx`
- `src/domain/order-state.ts`
- `src/domain/transitions.ts`
- `src/domain/types.ts`
- `src/store/use-prototype-store.ts`
- `src/data/demo-data.ts`
- `src/domain/fulfillment-finance.test.ts`
- `tests/e2e/prototype.spec.ts`
- `src/components/ui/modal.tsx`

## Implementation requirements

1. Replace the direct mutation attached to **Tutup order** with a review surface.
2. Derive one checklist from domain rules; do not duplicate eligibility logic in the component.
3. Show goods acceptance, SIPLah administration, school payment, and benefit as blocking checkpoints.
4. Show supplier payment separately and explicitly as non-blocking.
5. The review's first open state must leave the order unchanged.
6. Final confirmation must be specific, protected against repeated click, and fail safely with retained review context.
7. Close transition remains guarded at the domain boundary and appends a clear Timeline event. Include actor/reason only to the degree approved by decision #2 and possible in the single-operator prototype.
8. Replace generic **Tidak ada tindakan aktif** on closed orders with a read-only completion explanation. Do not offer snooze/manual action controls when closed.
9. Implement reopen only if decision #2 approves it. Require a non-empty reason, append rather than rewrite history, and restore a domain-derived active stage rather than a hard-coded arbitrary stage.
10. Do not build authentication, account administration, or a general permission system.

## Acceptance criteria

- [ ] First click opens review and does not close the order.
- [ ] Blocked fixtures show exact unmet prerequisites and cannot confirm.
- [ ] Eligible fixture explains supplier `PARTIAL` as non-blocking.
- [ ] Explicit confirmation closes exactly once.
- [ ] Error during close preserves the review state and offers retry.
- [ ] Closed workspace removes mutation controls across Finance, Distribution, Timeline, and manual Next Action.
- [ ] Closed Next Action panel uses accurate read-only copy.
- [ ] Timeline records close event without deleting earlier history.
- [ ] If reopen is approved, a reason is mandatory and reopen appends its own event.
- [ ] If a denied capability fixture is approved, it explains denial without exposing a dead CTA.
- [ ] Review modal is keyboard-operable, traps focus, closes with Escape, and restores trigger focus.
- [ ] At 390 px the checklist, warning, and confirmation controls remain visible above the bottom navigation/keyboard.

## Automated verification

Cover every readiness prerequisite, supplier independence, idempotent close, closed mutation guards, Timeline history, and approved reopen behavior. Replace the existing E2E step that closes immediately after one click.

Run all standard checks and `npm run test:e2e`.

## Mandatory browser verification

Use one blocked order, one eligible order, and one closed order. Verify review/cancel, review/confirm, repeated click, refresh persistence, closed tabs, Timeline, and the approved recovery path on desktop and 390 × 844.

## Stop conditions

Stop if decision #2 would require real user identity or role management. Propose the smallest prototype capability boundary instead of expanding into RBAC.
