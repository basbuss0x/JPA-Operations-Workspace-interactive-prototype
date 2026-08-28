# JPA-COR-13 - Operator Terminology

Phase: 2 - operational refinement  
Priority: P2/P3  
Blocked by: decision #4 and #7-#12  
Findings: UX-007, UX-015, UX-018  
Scope: operator-facing UI, Timeline labels, filters, and shared presentation mapping

## Outcome

The interface uses one approved operator vocabulary while canonical domain enums remain unchanged internally. Raw uppercase state values and mixed implementation language stop leaking through components.

## Target graph

```text
Canonical domain state
  -> centralized presentation mapping
    -> context-appropriate Indonesian label + explanation
      -> consistent UI, Timeline, filters, and workbook vocabulary
```

## Starting points

- `src/domain/presentation.ts`
- `src/domain/types.ts` label exports
- `src/components/ui/status-chip.tsx`
- `src/components/orders/order-state-summary.tsx`
- `src/routes/pipeline-page.tsx`
- `src/routes/vendor-batch-detail-page.tsx`
- `src/features/finance/finance-workspace.tsx`
- `src/features/timeline/order-timeline.tsx`
- `src/features/orders/order-tab-content.tsx`
- `src/routes/het-review-page.tsx`
- `src/routes/siplah-workflow-page.tsx`
- relevant UI/domain tests and E2E assertions

## Implementation requirements

1. Record the approved vocabulary from decision #4 in one presentation layer. Do not rename canonical domain enum values merely to change UI copy.
2. Replace ad hoc `.replaceAll('_', ' ')` rendering with typed, exhaustive label maps where operator-facing.
3. Initial audit vocabulary includes:
   - `PROCESSING` -> **Sedang diproses vendor**
   - `PARTIALLY_ARRIVED` -> **Tiba sebagian**
   - `ELIGIBLE` -> approved benefit obligation wording
   - `NOT_ELIGIBLE` -> **Belum wajib dibayar** or approved equivalent
   - `NONE` -> **Belum tiba**
   - `NOT_SET` -> **Belum ditetapkan**
   - `RECAP_GENERATED` -> **Rekap dibuat, belum dikirim**
   - `SYSTEM` / `NOTE` -> **Otomatis** / **Catatan operator**
4. Replace `derived` with **dihitung otomatis dari...** where trust matters and `lifecycle` with **tahap proses** in user copy.
5. Keep ARKAS, HET, SIPLah, Surat Pesanan, Invoice, BAST, and Vendor Batch unless decision #4 says otherwise.
6. Gross/net may remain only with plain-language helper text.
7. Reduce status-pill noise where plain text conveys the same non-actionable state, but retain color only where it communicates warning, blocking, selected, or success meaning.
8. Update tests to assert operator labels while keeping domain tests on canonical enum values.

## Acceptance criteria

- [ ] No audited operator surface shows raw `NOT_SET`, `NONE`, `ELIGIBLE`, `PARTIALLY_ARRIVED`, `SYSTEM`, or `NOTE` unless explicitly approved.
- [ ] Vendor status labels are consistent across Home, Orders, workspace, Vendor Batch, and Pipeline.
- [ ] Benefit labels communicate obligation rather than software eligibility jargon.
- [ ] Timeline differentiates automatic events and operator notes in Indonesian.
- [ ] Financial helper text explains gross, deduction, and net consistently.
- [ ] Status color meaning remains consistent.
- [ ] TypeScript makes missing new label-map cases visible.
- [ ] Domain values, persistence, selectors, and transition semantics do not change.
- [ ] Desktop and 390 px layouts tolerate longer translated labels.

## Automated verification

Add exhaustive mapping tests where useful and update E2E assertions that currently expect raw English enums. Include long-label wrapping and accessible-name assertions.

Run all standard checks and `npm run test:e2e`.

## Mandatory browser verification

Inspect Home, Orders, one workspace at each major lifecycle, HET resolved items, SIPLah, Vendor Batch, Finance, Timeline, and Pipeline on desktop and 390 px. Search the rendered application for the audited raw terms and record any intentionally retained exceptions.

## Stop conditions

Stop if a term is operationally ambiguous or decision #4 is incomplete. Do not auto-translate established business language without operator confirmation.
