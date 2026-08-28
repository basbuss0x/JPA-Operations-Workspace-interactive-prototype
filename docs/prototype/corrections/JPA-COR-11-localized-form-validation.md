# JPA-COR-11 - Localized Form Validation

Phase: 1 - field-test blocker  
Priority: P1/P2  
Blocked by: decision #4  
Findings: UX-007, UX-011 and critical required-field paths  
Primary flows: Payment, Benefit, HET override/reopen, reminder forms, New Order input

## Outcome

Critical forms explain problems next to the affected input in direct Indonesian, associate errors accessibly, retain valid work, and clear stale errors as soon as the relevant value becomes valid. Native English browser bubbles no longer control the recovery experience.

## Target graph

```text
Input
  -> validate at field/form boundary
    -> valid: commit
    -> invalid: inline local error + focus
      -> correction
        -> stale error clears/updates
          -> retry without re-entering valid data
```

## Starting points

- `src/components/ui/form-field.tsx`
- `src/components/ui/modal.tsx`
- `src/features/finance/finance-workspace.tsx`
- `src/routes/het-review-page.tsx`
- `src/routes/new-order-page.tsx`
- `src/routes/order-workspace-page.tsx`
- `src/routes/vendor-batch-detail-page.tsx`
- relevant domain transitions and tests
- `tests/e2e/prototype.spec.ts`

## Implementation requirements

1. Extend the shared FormField pattern to support error text, stable error ID, `aria-invalid`, and `aria-describedby` without forcing every field to render an error.
2. For controlled critical forms, prevent native browser validation from becoming the primary UI; implement explicit submit validation and focus the first invalid field.
3. Translate boundary failures into operator language without weakening domain guards.
4. Clear or recompute payment mismatch errors when gross/deduction inputs become valid; do not leave a stale rejection banner visible.
5. Transfer reference is required only for `TRANSFER`; switching to `CASH` clears both hidden value and stale error.
6. HET manual override/reopen reason errors remain close to the relevant field and final confirmation stays disabled until item-level requirements pass.
7. Failed submit retains every valid value and clearly distinguishes field errors from persistence/action errors.
8. Avoid a generic form framework dependency. Reuse the existing controlled-state approach and shared primitives.

## Acceptance criteria

- [ ] Tested critical forms show Indonesian inline errors rather than native English bubbles.
- [ ] Each field error is programmatically associated and announced.
- [ ] First invalid field receives focus after submit.
- [ ] Correcting gross/deduction clears or updates the stale mismatch error immediately.
- [ ] Transfer reference is conditionally required and absent for CASH.
- [ ] Correcting a field does not erase unrelated valid inputs.
- [ ] Domain/action failures remain visible and retryable without being mislabeled as field errors.
- [ ] Modal height, keyboard focus, and CTA remain usable at 390 px with the on-screen keyboard.
- [ ] Reminder validation integrates with #7 rather than creating a competing message pattern.
- [ ] No new dependency is introduced.

## Automated verification

Add component or E2E coverage for invalid submit, error association, focus, correction clearing, CASH/TRANSFER switching, HET reason requirement, and persistence failure retention. Do not assert only CSS classes; test accessible labels/messages and resulting state.

Run all standard checks and `npm run test:e2e`.

## Mandatory browser verification

Exercise payment gross mismatch, corrected amounts, missing benefit transfer reference, CASH switch, HET manual override without reason, New Order missing input, and reminder invalid date on desktop and 390 × 844. Verify browser-native English bubbles do not appear.

## Stop conditions

Stop if decision #4 leaves critical financial terminology unresolved. Implement structural error behavior independently only if copy can remain a clearly marked temporary operator label.
