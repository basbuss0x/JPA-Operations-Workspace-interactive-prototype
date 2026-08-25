# Review Gate 1 — Product Decisions for the Next Pass

Status: Review Gate 1.1 approved; Pass 2 authorized and implemented through TASK 06–08 pending Review Gate 2.

These decisions remain binding for future implementation passes.

## Work Queue — vendor follow-up

`PROCESSING` alone is passive and must not create an immediate Work Queue item.

Vendor follow-up enters the Work Queue only when:

- an explicit reminder/due date has been reached, or
- a defined stale threshold has been breached.

The stale threshold and its time source must be made explicit before implementation.

## Goods arrival allocation

Goods arrival must support allocation per school/order within a Vendor Batch.

Never assume that recording arrival for a Vendor Batch means every member order arrived uniformly or completely. Partial and full quantities must remain attributable to the affected school orders.

## SIPLah admin completion

SIPLah has two derived checkpoints:

- `isSiplahReadyForVendor(order)` — HET approved, access available, order placed and numbered, and Surat Pesanan available/attached/verified/sent to school.
- `isSiplahAdminComplete(order)` — completion of the SIPLah order and verification of documents marked for administrative completion.

Invoice, Kwitansi, and BAST are later administrative documents and do not block Vendor Batch readiness. These derived states are independent from school payment and must not be inferred from payment status.

## Financial amount concepts

Keep these values separately representable:

- `arkasBudgetAmount` — immutable amount from the ARKAS source document
- `hetReviewedAmount` — amount produced by the completed HET review
- `finalInvoiceAmount` — financial truth after the SIPLah transaction is explicitly confirmed; HET approval alone does not establish it
- `schoolPaidAmount` — amount actually confirmed as received from the school

ARKAS is immutable source data. Do not overwrite `arkasBudgetAmount` as review and transaction values change.

## Benefit base and freezing

The benefit base is exactly 10% of `finalInvoiceAmount`.

In the normal workflow, freeze the benefit base/amount once school payment is confirmed `LUNAS`. Later changes must not silently recalculate an already-established benefit obligation; any exceptional correction flow must be explicit.

## Gate 1.1 implementation boundary

The shared foundation now supports multiple action candidates, action-level snooze, reached-date reminders, targeted per-order goods arrival, separate financial amounts, frozen benefit obligations, and derived SIPLah admin completion.

Still deferred:

- automatic vendor stale thresholds, pending real operational evidence
- detailed goods-arrival allocation UI (TASK 11)
- full payment and benefit UI (TASK 12)

Pass 2 keeps Product Master, extraction, and document files as deterministic local fixtures. Do not begin TASK 09+ until Review Gate 2 is approved.
