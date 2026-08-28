# JPA-COR-16 - Send-Ready Vendor Workbook

Phase: 2 - operational refinement  
Priority: P2  
Blocked by: decision #5  
Findings: UX-010, UX-018  
Primary flow: Vendor Batch recap generation and `.xlsx` artifact

## Outcome

The generated workbook can be sent to a vendor without routine label/date/identity cleanup while preserving exact aggregate and school-allocation quantities and never implying that generation equals sending.

## Target graph

```text
Vendor Batch data + approved metadata
  -> build workbook
    -> Ringkasan Vendor
    -> Breakdown Sekolah
      -> download
        -> batch remains generated, not sent
```

## Starting points

- `src/features/vendor/vendor-workbook.ts`
- `src/features/vendor/vendor-workbook.test.ts`
- `src/features/vendor/vendor-recap-view.tsx`
- `src/routes/vendor-batch-detail-page.tsx`
- `src/domain/types.ts`
- `src/data/demo-data.ts`
- `src/store/migrate-prototype-state.ts`
- `tests/e2e/prototype.spec.ts`

## Implementation requirements

1. Implement only the metadata approved in decision #5 and identify its prototype source. Prefer a small explicit config/fixture over editable commercial master-data features.
2. Format preparation date in local, human-readable Indonesian form; do not emit raw ISO/UTC as operator-facing content.
3. Normalize labels such as **Jumlah jenis produk**, **Total jumlah buku**, and **Jumlah** according to decision #4/#5.
4. Add vendor identity and approved delivery/contact notes to the summary without duplicating them unnecessarily in every row.
5. Preserve the two-sheet structure and exact aggregate/school allocation math.
6. Apply practical column widths, wrapping, print area/header/footer or equivalent lightweight formatting supported by the existing library. Do not turn this into a spreadsheet-design project.
7. Keep filename understandable and deterministic.
8. Preserve **generated/downloaded is not sent** in both UI transition and tests.
9. Never add supplier prices, costs, margins, tax assumptions, or invented financial metadata.
10. If schema changes, add versioned migration and reset coverage.

## Acceptance criteria

- [ ] Summary includes approved vendor identity and operational contact/delivery context.
- [ ] Preparation date is human-readable local time.
- [ ] All workbook labels are consistent and approved.
- [ ] Summary totals equal 69 books for the canonical two-school batch.
- [ ] BK-MTK-5 = 28, BK-BINDO-5 = 21, BK-IPAS-5 = 20.
- [ ] School breakdown remains SDN 40 = 55 and SLB Batu Merah = 14 for the canonical fixture.
- [ ] Workbook opens in a standard reader and sheets/columns are readable without routine cleanup.
- [ ] No fake commercial fields appear.
- [ ] Generating/regenerating does not mark the batch sent.
- [ ] Existing arrival and membership semantics do not change.

## Automated and artifact verification

Extend workbook tests to inspect metadata cells, date format/type, labels, sheet names, totals, widths/formatting, and absence of prohibited fields. Generate a real file and open/render both sheets for visual inspection.

Run all standard checks and `npm run test:e2e`.

## Mandatory browser verification

Create the canonical SDN 40 + SLB batch, generate/download, verify UI remains **belum dikirim**, inspect both workbook sheets, regenerate, then explicitly mark sent. Record the output file and rendered sheet evidence.

## Stop conditions

Stop if vendor/contact/delivery metadata has no approved source. Do not hard-code invented real-world identity data or add a broad vendor-management module.
