# JPA-COR-12 - Mobile Workspace Navigation

Phase: 2 - operational refinement  
Priority: P2/P3  
Blocked by: #10, #11  
Findings: UX-006, UX-017 and mobile audit observations  
Primary viewport: 390 × 844

## Outcome

A one-handed operator can discover every order section and quick filter, identify the current section, return to earlier context, and use the top/bottom navigation without clipped labels or an over-prominent destructive demo reset action.

## Target graph

```text
Order workspace on mobile
  -> explicit section navigation
    -> selected section always identifiable
      -> perform task
        -> return without losing useful context

Orders filter
  -> discover all filter choices
    -> selected filter remains visible
```

## Starting points

- `src/components/ui/tabs.tsx`
- `src/routes/order-workspace-page.tsx`
- `src/routes/orders-page.tsx`
- `src/components/layout/app-shell.tsx`
- `src/styles/index.css`
- `tests/e2e/prototype.spec.ts`

## Implementation requirements

1. Inspect the existing tab auto-scroll before replacing it. Choose the smallest explicit mobile pattern that makes all seven sections discoverable: compact section select/menu, stronger overflow control, or another existing-system-compatible approach.
2. Preserve route-aware `?tab=` URLs and desktop tab behavior.
3. The current section must be announced visually and accessibly and remain visible after navigation/reload.
4. Avoid relying only on a thin scrollbar or small edge arrows.
5. Apply the same discoverability principle to narrow quick-filter overflow while keeping filters fast to scan.
6. Preserve scroll/focus context where practical when switching sections or returning from a focused route.
7. Add right/bottom safe-area spacing for topbar and bottom navigation.
8. Demote **Reset Demo Data** on mobile into a clearly secondary prototype control without removing reset capability.
9. Do not make the mobile header or primary content taller than necessary; action content should not be pushed far below the fold.

## Acceptance criteria

- [ ] A first-time user can discover all seven order sections at 390 px without guessing horizontal scroll.
- [ ] Selected section is visible, named, and reflected in the URL.
- [ ] Direct links to Finance/Timeline open with correct selected navigation state.
- [ ] Back/forward/reload preserve section state.
- [ ] Keyboard and touch interaction both work.
- [ ] Quick filters are discoverable and selected filter remains visible.
- [ ] Topbar and rightmost bottom-nav item are not clipped near the scrollbar/safe area.
- [ ] Reset remains available but no longer competes with primary field operations.
- [ ] Modal/footer controls remain reachable above the mobile keyboard and navigation.
- [ ] Desktop tabs and Orders toolbar do not regress.

## Automated verification

Add E2E assertions for direct deep links, section selection, selected-state visibility, back/forward/reload, all filter choices, and 390 px safe-area layout. A screenshot is supporting evidence, not the only assertion.

Run all standard checks and `npm run test:e2e`.

## Mandatory browser verification

At 390 × 844, navigate Overview -> Finance -> ARKAS -> Timeline, use browser back/forward, refresh, apply the rightmost Orders filter, open/close a modal with the virtual keyboard behavior available, and inspect top/bottom edges. Repeat a desktop regression.

## Stop conditions

Stop if the selected mobile pattern changes route semantics or hides independently important Next Action content. Bring back measured alternatives rather than inventing a new global navigation system.
