# JPA-COR-17 - Tracker Conflict Fixture

Phase: 2 - operational refinement  
Priority: P2  
Blocked by: decision #6  
Finding: UX-013  
Primary route: `/orders/:orderId?tab=distribution`

## Outcome

A reviewer can trigger a lower-cumulative tracker snapshot directly from the visible deterministic controls and see the last known good data preserved, the conflict distinguished from stale/error transport states, and the recovery action explained.

## Target graph

```text
Refresh tracker
  -> success/increase: replace cache
  -> stale: preserve cache + stale explanation
  -> connection error: preserve cache + retry explanation
  -> lower cumulative conflict
    -> quarantine incoming value
      -> preserve last known good cache
        -> explain reconciliation in external tracker
```

## Starting points

- `src/data/tracker-fixtures.ts`
- `src/features/distribution/distribution-workspace.tsx`
- `src/domain/types.ts`
- `src/domain/transitions.ts`
- `src/domain/fulfillment-finance.test.ts`
- `tests/e2e/prototype.spec.ts`

## Implementation requirements

1. Add a deterministic visible outcome for lower cumulative delivery. It must not require localStorage manipulation.
2. Reuse the existing domain protection that preserves last known good data, adjusting only if decision #6 requires a clearer distinct conflict representation.
3. Distinguish semantic data conflict from stale snapshot and connection failure in label, message, and recommended action.
4. Display incoming and cached quantities in plain operator language.
5. Direct detailed reconciliation to the external Kelengkapan Tracker; do not build title-level reconciliation here.
6. Append a concise Timeline event and preserve lifecycle/completion state.
7. If `SyncStatus` changes, migrate persisted data safely and keep old states readable.
8. Keep successful increasing refresh behavior unchanged.

## Acceptance criteria

- [ ] Visible control offers a lower-cumulative conflict scenario.
- [ ] Triggering it preserves delivered, remaining, problem count, progress, and last known good update time.
- [ ] Last sync attempt time updates.
- [ ] Incoming and cached quantities are stated clearly.
- [ ] Conflict is distinguishable from STALE and ERROR.
- [ ] Operator is directed to reconcile in the external tracker.
- [ ] Timeline records the conflict.
- [ ] A 100%/completion-stage order cannot regress.
- [ ] Successful increasing refresh still updates normally.
- [ ] Behavior works on desktop and 390 px.

## Automated verification

Retain and extend existing lower-cumulative domain tests. Replace the E2E localStorage mutation with the visible UI fixture. Cover success, stale, error, conflict, persistence, Timeline, and completion-stage protection.

Run all standard checks and `npm run test:e2e`.

## Mandatory browser verification

On ORD-2026-065, establish or use a last known good value, trigger conflict, inspect preserved quantities/message/Timeline, then test stale, error, and increasing success. Repeat the conflict state at 390 × 844.

## Stop conditions

Stop if decision #6 requires a real reconciliation workflow or external API mutation. This card is limited to deterministic conflict exposure and safe cache behavior.
