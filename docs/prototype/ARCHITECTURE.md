# Architecture — Interactive Prototype

## Intent

This document defines the prototype architecture, not the future production architecture. Keep it simple enough to iterate quickly but structured enough that workflows do not collapse into one giant component or status enum.

## Recommended prototype stack

If the repository has no existing stack, use:

- React
- TypeScript
- Vite
- React Router
- Zustand or an equivalently small client-state store
- localStorage persistence
- SheetJS/xlsx for client-side vendor recap export

If a stack already exists by implementation time, follow the repository unless there is a strong reason not to.

## Route map

```text
/
  Home / Kerjakan Sekarang

/orders
  Semua Pesanan

/orders/new
  Pesanan Baru / ARKAS intake

/orders/:orderId
  Order Workspace

/orders/:orderId/arkas
  ARKAS + HET review

/orders/:orderId/siplah
  SIPLah workflow

/orders/:orderId/vendor
  Vendor context for the order

/orders/:orderId/distribution
  Goods + fulfillment summary

/orders/:orderId/finance
  School payment + benefit + supplier summary

/orders/:orderId/timeline
  Timeline + notes

/pipeline
  Cross-order pipeline overview

/vendor-batches
  Vendor batch list

/vendor-batches/new
  Vendor batch builder

/vendor-batches/:batchId
  Vendor batch detail/lifecycle
```

Tabs under `/orders/:orderId` may be implemented as nested routes or route-aware tabs. Prefer URLs that remain shareable/readable.

## Suggested source structure

```text
src/
├── app/
│   ├── router/
│   └── providers/
├── routes/
├── components/
│   ├── ui/
│   └── layout/
├── features/
│   ├── work-queue/
│   ├── orders/
│   ├── arkas/
│   ├── het/
│   ├── siplah/
│   ├── vendor/
│   ├── distribution/
│   ├── finance/
│   └── timeline/
├── domain/
│   ├── types.ts
│   ├── selectors.ts
│   ├── next-action.ts
│   └── transitions.ts
├── data/
│   └── demo-data.ts
├── store/
├── utils/
└── styles/
```

Avoid premature micro-abstractions. The important separation is domain/state logic vs rendering.

## Core domain shape

Suggested conceptual model:

```text
School
└── Order
    ├── OrderItem[]
    ├── ArkasDocument
    ├── HetReview
    ├── SiplahProcess
    ├── VendorBatchMembership?
    ├── FulfillmentSummary
    ├── SchoolPayment
    ├── SchoolBenefit
    ├── SupplierPaymentSummary
    ├── NextActionOverride?
    └── TimelineEvent[]

VendorBatch
├── orderIds[]
├── aggregatedItems[]   (derived)
├── generatedRecap?
└── lifecycle
```

## Lifecycle states

### Order lifecycle stage

```text
INTAKE
HET_REVIEW
SIPLAH
VENDOR
GOODS_ARRIVED
DISTRIBUTION
COMPLETION
CLOSED
```

This is broad positioning only.

### HET review

```text
NOT_STARTED
EXTRACTED
NEEDS_REVIEW
APPROVED
```

Each item can separately be:

```text
MATCHED
PRICE_MISMATCH
AMBIGUOUS_MATCH
NO_MATCH
MANUAL_OVERRIDE
```

### SIPLah

Track checkpoints rather than one boolean:

```text
accessAvailable
orderPlaced
orderNumber?
suratPesananAvailable
suratPesananAttached?
suratPesananSentToSchool
```

`adminCompleted` is derived from completion of the SIPLah order and verification of the required order documents. It is not an independently mutable checkbox and is independent from school payment.

Do not store a school SIPLah password.

### Vendor batch lifecycle

```text
DRAFT
RECAP_GENERATED
SENT_TO_VENDOR
VENDOR_CONFIRMED
PROCESSING
PARTIALLY_ARRIVED
ARRIVED
```

Critical rule: creating a batch does not imply it has been sent.

### School payment

Prototype can support:

```text
UNPAID
LUNAS
```

Store date/method/evidence metadata in the model even if evidence is simulated. Keep `arkasBudgetAmount`, `hetReviewedAmount`, `finalInvoiceAmount`, and `schoolPaidAmount` separately representable. ARKAS source amount is immutable.

### School benefit

```text
NOT_ELIGIBLE
ELIGIBLE
PAID
```

Benefit amount is established from `finalInvoiceAmount * 0.10`. Once school payment is confirmed `LUNAS`, freeze both the benefit base and obligation amount so later amount mutation cannot silently change the obligation.

### Fulfillment

Treat detailed delivery as external. Store a mocked summary:

```text
orderedQty
deliveredQty
remainingQty
problemCount
progressPercent
lastUpdated
syncStatus
```

## State transition rules

Do not implement magic state jumps.

Examples:

```text
ARKAS uploaded
→ extraction simulation completed
→ HET review may become NEEDS_REVIEW

all HET exceptions resolved + owner confirms
→ HET APPROVED
→ order can progress to SIPLAH

SIPLah checklist complete
→ order becomes eligible for vendor batching

Vendor batch created
→ batch is DRAFT
→ order can be associated with the draft

recap generated
→ batch RECAP_GENERATED

operator marks sent
→ batch SENT_TO_VENDOR

vendor confirmed
→ VENDOR_CONFIRMED / PROCESSING

goods arrival recorded with explicit per-order allocations
→ only allocated school orders receive arrival state
→ batch becomes PARTIALLY_ARRIVED or ARRIVED from its member allocations
→ affected order can surface goods-check next action

school payment set LUNAS
→ benefit automatically becomes ELIGIBLE if not already PAID

benefit recorded PAID
→ completion readiness is recalculated
```

## Derived state

Prefer selectors/derived logic for:

- action candidates and primary next action
- vendor batch eligibility
- HET exception counts
- benefit amount
- benefit eligibility
- completion readiness
- active work queue
- pipeline grouping
- aggregated vendor quantities

Do not duplicate these as manually maintained fields unless the prototype needs an explicit override.

## Next Action engine

Derive all independently actionable obligations before selecting a primary recommendation:

```text
deriveActionCandidates(order, context, now)
→ NextAction[]

derivePrimaryNextAction(candidates)
→ NextAction | null
```

Suggested priority rules:

1. unresolved HET exception
2. SIPLah workflow incomplete after HET approval
3. SIPLah complete but not in an active/sent vendor batch
4. vendor goods arrived and need checking
5. fulfillment incomplete and actionable
6. school payment follow-up only when its due date is reached
7. school payment LUNAS + benefit ELIGIBLE
8. order completion/close
9. explicit vendor follow-up only when its due date is reached

A manual action may be pinned as primary, but system obligations remain candidates. Snooze controls are keyed by action kind so one concern cannot hide another. `PROCESSING` alone is passive; stale-threshold follow-up remains deferred until real operational evidence exists.

The primary suggestion is not an immutable workflow lock.

## Vendor aggregation

Vendor batch must preserve both views:

### Aggregate view

```text
Product A = 65 total
Product B = 21 total
```

### School breakdown

```text
Product A
- SDN 30: 20
- SDN 71: 15
- SDN 40: 30
```

Aggregate quantities should be derived from selected order items, not manually re-entered.

## Persistence

Prototype state should persist to localStorage.

Requirements:

- version the stored demo-state shape
- gracefully reset if incompatible
- provide a visible `Reset Demo Data` action
- canonical demo data must be reproducible

## Excel export

For vendor recap, client-side export is allowed and encouraged.

Export should include at least:

- batch ID/date
- aggregated product title/code if available
- total qty
- school-by-school breakdown in a second sheet or clearly structured section

The exact workbook styling is prototype-level, not production-level.

## Security boundary for prototype

Never store or display real SIPLah credentials.

Use simulated attachments/evidence metadata only. The prototype is not a secure document vault.

## Testing expectations

At minimum, domain logic should be testable for:

- benefit calculation/eligibility
- vendor batch eligibility
- aggregation
- next-action derivation
- important state transitions

UI smoke tests are useful if the chosen setup makes them easy, but do not overbuild testing infrastructure for the prototype.
