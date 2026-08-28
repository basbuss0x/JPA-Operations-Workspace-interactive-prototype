# JPA-COR-15 - SIPLah Document Hierarchy

Phase: 2 - operational refinement  
Priority: P2  
Blocked by: none  
Finding: UX-009  
Primary route: `/orders/:orderId/siplah`

## Outcome

The SIPLah surface makes the procurement blocker unmistakable: Surat Pesanan is the primary Vendor-readiness work, while Invoice, Kwitansi, and BAST are summarized under a quieter **Administrasi menyusul** group that remains available for later completion.

## Target graph

```text
SIPLah transaction confirmed
  -> procurement documents
    -> Surat Pesanan incomplete: blocks Vendor readiness
    -> Surat Pesanan complete: Vendor-ready
  -> Administrasi menyusul
    -> Invoice / Kwitansi / BAST tracked separately
      -> admin complete later
```

## Starting points

- `src/routes/siplah-workflow-page.tsx`
- `src/features/orders/order-tab-content.tsx`
- `src/domain/siplah.ts`
- `src/domain/order-state.ts`
- `src/domain/presentation.ts`
- `src/styles/index.css`
- `src/domain/siplah.test.ts`
- `tests/e2e/prototype.spec.ts`

## Implementation requirements

1. Preserve `isSiplahReadyForVendor` and `isSiplahAdminComplete` as separate derived concepts.
2. Render Vendor-readiness documents first with strong hierarchy. In the current prototype this centers Surat Pesanan.
3. Group later required admin documents into a secondary expandable/compact **Administrasi menyusul** section with one summary status.
4. Keep individual later-document actions available after expansion; do not erase state granularity.
5. Ensure step order/copy cannot imply that admin completion is required before Vendor Batch.
6. Preserve final SIPLah amount, order number, document attachment, verification, and sent-to-school semantics.
7. Keep optional SIPLah PDF distinct from required administration.
8. Avoid giving every sub-state equal chip weight. Show the action that unblocks procurement first.

## Acceptance criteria

- [ ] Incomplete Surat Pesanan is visually and semantically the primary blocker.
- [ ] Invoice/Kwitansi/BAST are summarized as later administration.
- [ ] Completing Surat Pesanan makes the order Vendor-ready even while later documents remain incomplete.
- [ ] Later documents can still be opened and completed individually.
- [ ] Admin-complete derivation remains unchanged and independently visible.
- [ ] Final SIPLah amount remains distinct from ARKAS and reviewed HET.
- [ ] Disabled actions explain their prerequisite.
- [ ] The hierarchy is understandable at desktop and 390 px without excessive first-screen density.

## Automated verification

Retain existing selector/transition tests and add UI/E2E assertions for grouping, collapsed summary, expansion, Vendor readiness before admin completion, and later admin completion.

Run all standard checks and `npm run test:e2e`.

## Mandatory browser verification

Walk access -> order placement -> final amount/order number -> incomplete Surat Pesanan -> complete Surat Pesanan -> Vendor-ready while admin remains incomplete -> expand and complete later admin. Repeat critical states at 390 × 844.

## Stop conditions

Stop if the design changes the readiness rule or hides a document action required by the canonical flow. This card changes hierarchy, not business semantics.
