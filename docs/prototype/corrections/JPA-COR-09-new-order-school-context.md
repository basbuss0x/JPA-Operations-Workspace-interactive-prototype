# JPA-COR-09 - New Order School Context

Phase: 1 - field-test blocker  
Priority: P1  
Blocked by: decision #3  
Finding: UX-005  
Primary route: `/orders/new`

## Outcome

New Order starts with no school context and cannot reach ARKAS extraction or order creation until the operator explicitly selects an eligible existing school or creates a valid, non-duplicate school.

## Target graph

```text
New Order
  -> no school selected
    -> search/select eligible school
      -> confirm identity
        -> ARKAS intake
    -> create new school
      -> validate and check duplicates
        -> confirm identity
          -> ARKAS intake

Inactive school
  -> historical context only
    -> cannot be selected for new order
```

## Starting points

- `src/routes/new-order-page.tsx`
- `src/domain/types.ts`
- `src/domain/intake.ts`
- `src/domain/selectors.ts`
- `src/data/demo-data.ts`
- `src/store/use-prototype-store.ts`
- `src/store/migrate-prototype-state.ts`
- `src/domain/intake.test.ts`
- `src/store/migrate-prototype-state.test.ts`
- `tests/e2e/prototype.spec.ts`

## Implementation requirements

1. Initialize existing-school selection to empty, never `existingSchools[0]`.
2. Do not infer institutional eligibility from an order's `CLOSED` stage unless decision #3 explicitly defines that rule. A school can have historical orders.
3. Implement the smallest explicit eligibility source approved in decision #3. If state schema changes, version and migrate it deliberately.
4. Separate active selectable schools from inactive/historical results. Inactive schools must be non-selectable and clearly explained if shown.
5. Disable extraction until a valid school context is explicitly confirmed.
6. Switching existing/new mode clears stale hidden selection or draft values that could be committed accidentally.
7. Check normalized names/identifiers for likely duplicate schools before creating a new one.
8. Show a compact selected-school confirmation summary before ARKAS extraction and again before order creation.
9. Back/revisit behavior may preserve a deliberate valid selection, but must not restore an implicit or now-ineligible school.

## Acceptance criteria

- [ ] Opening `/orders/new` has no selected school.
- [ ] **Demo Closed School** is never selected by default.
- [ ] Extraction cannot run until an eligible context is explicitly selected/created.
- [ ] Inactive school cannot become a new order target.
- [ ] Search/select supports loading, no match, error, and retry if the chosen pattern needs them.
- [ ] Likely duplicate school creation is intercepted before order creation.
- [ ] Switching modes cannot leak stale school ID/name into the order.
- [ ] Confirmation summary identifies the school before extraction and creation.
- [ ] Created order stores a stable school identity, not only an unvalidated display string.
- [ ] Refresh/reset/migration behavior is deterministic.
- [ ] 390 px controls are touch-safe and do not rely on hover.

## Automated verification

Cover no selection, active selection, inactive rejection, duplicate detection, mode switching, stable school identity, reset, and migration if applicable. Add E2E checks for initial empty state and attempted progression without selection.

Run all standard checks and `npm run test:e2e`.

## Mandatory browser verification

Reset demo data, open New Order, attempt extraction without selection, select an active school, inspect confirmation, switch to new-school mode and back, test duplicate/inactive cases, then complete the deterministic ARKAS flow on desktop and 390 × 844.

## Stop conditions

Stop if decision #3 does not distinguish an inactive school from a historical closed order. Do not encode the string **Demo Closed School** as business logic.
