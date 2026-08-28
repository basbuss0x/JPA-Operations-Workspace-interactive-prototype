# JPA-COR-10 - Desktop Operational Visibility

Phase: 1 - field-test blocker  
Priority: P1 with contained P3 refinement  
Blocked by: #7  
Findings: UX-004, UX-016  
Primary routes: `/orders`, `/pipeline`

## Outcome

At a supported laptop viewport, operators can see or unmistakably reach payment, benefit, blockers, and later lifecycle stages. Critical context no longer depends on discovering an off-screen horizontal scrollbar.

## Target graph

```text
Home or direct navigation
  -> scan Orders / Pipeline
    -> identify school, stage, blocker, payment, benefit, next action
      -> open exact order context
```

## Starting points

- `src/routes/orders-page.tsx`
- `src/routes/pipeline-page.tsx`
- `src/components/orders/order-state-summary.tsx`
- `src/domain/presentation.ts`
- `src/styles/index.css`
- `tests/e2e/prototype.spec.ts`

## Implementation requirements

1. Measure the current supported desktop viewports before choosing a pattern. Reuse the existing table/cards/design tokens.
2. Orders must keep identity, stage, Next Action, payment, and benefit visible at a normal laptop width. HET/SIPLah/Vendor/Barang may use a compact combined summary if needed, but no critical signal may disappear silently.
3. Prefer an intentional responsive mode over a table wider than its container with weak overflow. If horizontal overflow remains, add a persistent cue, sticky identity, and keyboard/touchpad access.
4. Pipeline must expose later stages through a visible control or an intentional responsive layout. Do not make Home secondary or overload cards with every state.
5. Preserve two most relevant signals and Next Action on Pipeline cards.
6. Collapse or compact truly empty stages only when this improves scanability without hiding lifecycle meaning.
7. Support long school names, zero/one/many records, closed toggle, keyboard focus, and browser zoom.
8. Do not solve desktop visibility by forcing the mobile card layout at all widths without measuring density and scan speed.

## Acceptance criteria

- [ ] Payment and benefit status are visible at the agreed laptop viewport without horizontal page scrolling.
- [ ] School identity, stage, blocker/Next Action remain visible in the same scan.
- [ ] Every Pipeline stage is visible or reachable through an always-visible affordance.
- [ ] Mouse, keyboard, and touchpad users can reach all retained overflow content.
- [ ] Long names do not overlap chips/actions.
- [ ] Empty, one-record, and high-volume fixtures remain understandable.
- [ ] Closed toggle still works and closed orders remain secondary.
- [ ] Empty-stage compaction does not remove active-stage context.
- [ ] Home remains the primary queue in copy and navigation hierarchy.
- [ ] Existing mobile card behavior does not regress.

## Automated verification

Add viewport assertions for at least 1366 × 768 and the project's wide desktop baseline. Prefer behavioral assertions over screenshot-only tests: visibility, reachable stages, scroll/focus state, and intact links. Keep a visual screenshot for review.

Run all standard checks and `npm run test:e2e`.

## Mandatory browser verification

Inspect Orders and Pipeline at 1366 × 768, a wider desktop viewport, 200% browser zoom where practical, and 390 × 844 regression. Test long names, filters, closed toggle, keyboard traversal, and every later Pipeline stage.

## Stop conditions

Stop if the proposed layout removes independently important payment/benefit signals or promotes Pipeline over Home. Return measured alternatives rather than forcing a broad redesign.
