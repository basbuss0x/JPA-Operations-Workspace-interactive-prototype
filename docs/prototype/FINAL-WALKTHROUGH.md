# Final Prototype Walkthrough

## Purpose

Use this prototype to evaluate whether one operator can move school orders through the real workflow with less re-entry, memory burden, and operational ambiguity. Home remains the primary work queue; Pipeline is a secondary lifecycle overview.

Reset Demo Data before a review to restore the canonical scenarios.

## Recommended demo journey

1. **ARKAS → HET → SIPLah**
   - Create a demo order from `/orders/new`.
   - Run deterministic extraction and resolve only the HET exceptions.
   - Confirm HET explicitly and verify ARKAS source, reviewed HET, and final SIPLah amount remain separate.
   - Complete access, transaction, order number, and Surat Pesanan checkpoints.
   - Verify Vendor readiness while Invoice, Kwitansi, and BAST remain later administration.

2. **Multi-school Vendor productivity**
   - Select SDN 40 Ambon and SLB Batu Merah in `/vendor-batches/new`.
   - Verify derived totals and school allocations without quantity re-entry.
   - Create DRAFT, generate the XLSX recap, then explicitly mark sent, confirmed, and processing.
   - Record arrival for only one school and verify its sibling remains unchanged.

3. **Goods and external fulfillment boundary**
   - Open SDN 239 MT and complete the explicit goods check.
   - Refresh the deterministic tracker cache and observe OK, STALE, and ERROR handling.
   - Open SDN 65 Ambon to verify the whole-order `314 / 247 / 67` context.
   - Detailed title reconciliation remains in the external Kelengkapan Tracker.

4. **Payment, benefit, and completion**
   - Open SDN 68 Ambon and confirm gross payment Rp24.350.000 with a Rp350.000 deduction.
   - Verify net received Rp24.000.000 and frozen benefit Rp2.435.000.
   - Record one full CASH or TRANSFER benefit payment, then explicitly close the order.
   - Supplier PARTIAL does not block closure; CLOSED removes operational mutation controls.

5. **Parallel work and context recovery**
   - Open SDN 65 Ambon to see fulfillment and benefit obligations together.
   - Snooze one action and verify the other remains active.
   - Use Home, Pipeline, the Order Overview, and Timeline to recover context across HET, SIPLah, Vendor, goods, distribution, and payment scenarios.

## Prototype validated

- workflow and domain interaction across the full school-order lifecycle
- independent lifecycle, HET, SIPLah, Vendor, fulfillment, payment, benefit, and supplier states
- local versioned demo persistence and canonical reset
- deterministic simulated ARKAS extraction and tracker refreshes
- allocation-aware Vendor Batch recap and real client-side XLSX export
- desktop and approximately 390px mobile operational flows

## Not yet production

- backend or database
- authentication or authorization
- real file/document storage
- real SIPLah integration or school credentials
- real Kelengkapan Tracker authentication/API sync
- multi-user concurrency and conflict resolution
- production audit, security, privacy, backup, or retention controls
- production deployment and observability architecture

This is a local frontend product-R&D prototype, not a production-secure operational system.
