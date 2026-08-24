# Review Gate 1 — Product Decisions for the Next Pass

Status: Review Gate 1 provisionally accepted.

These decisions are binding input for future implementation passes. They are recorded here only; this commit does not begin TASK 06+ or retrofit the Pass 1 prototype.

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

`adminCompleted` is derived from:

- completion of the SIPLah order process, and
- verification of the documents required for that specific order.

It is independent from school payment and must not be inferred from payment status.

## Financial amount concepts

Keep these values separately representable:

- `arkasBudgetAmount` — immutable amount from the ARKAS source document
- `hetReviewedAmount` — amount produced by the completed HET review
- `finalInvoiceAmount` — financial truth after the transaction is finalized
- `schoolPaidAmount` — amount actually confirmed as received from the school

ARKAS is immutable source data. Do not overwrite `arkasBudgetAmount` as review and transaction values change.

## Benefit base and freezing

The benefit base is exactly 10% of `finalInvoiceAmount`.

In the normal workflow, freeze the benefit base/amount once school payment is confirmed `LUNAS`. Later changes must not silently recalculate an already-established benefit obligation; any exceptional correction flow must be explicit.

## Explicit deferral

Implementation consequences of these decisions are deferred until the relevant task cards are authorized. Do not begin TASK 06+ solely because these decisions have been recorded.
