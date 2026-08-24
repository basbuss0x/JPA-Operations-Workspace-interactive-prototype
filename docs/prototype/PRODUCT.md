# Product — JPA Operations Workspace Interactive Prototype

## Product statement

JPA Operations Workspace is an operational workspace for managing school procurement orders from ARKAS intake through HET validation, SIPLah purchasing, vendor procurement, goods arrival, school distribution, payment, school benefit, and completion.

It is not primarily a dashboard. It should actively help the operator execute work.

## Core problem

When multiple schools order at once, one operator must remember and coordinate many partially independent threads:

- which schools have actually agreed to order
- whether ARKAS has been received/captured
- whether ARKAS matches HET and where differences exist
- whether SIPLah access is available
- whether the order has been placed in JPA's store
- whether Surat Pesanan exists and has been sent back to the school
- which orders are ready to consolidate for the vendor
- whether a vendor recap was generated, sent, confirmed, processed, or arrived
- whether goods are ready for delivery or still incomplete
- whether the school has paid
- whether the 10% school benefit is now eligible or paid
- what the operator should do next

A passive status board does not solve enough of this problem.

## Product goal

Reduce the operator's cognitive and repetitive administrative workload.

The prototype should test whether the product can:

1. Tell the operator what should be worked on now.
2. Reuse structured order data instead of requiring repeated copy/paste.
3. Surface exceptions rather than making the operator re-check everything.
4. Turn multi-school work into batch operations where appropriate.
5. Preserve context so old orders are immediately understandable.
6. Support realistic intermediate states instead of magic status jumps.

## Productivity test

For every feature ask:

1. What repetitive work does this remove?
2. What decision does this make easier?
3. What information does the operator no longer need to remember?
4. What action can be completed directly here?
5. Can the system derive a useful next action automatically?

If a feature answers none of these questions, it is probably not important for this prototype.

## Primary experience

### Home — Kerjakan Sekarang

The first screen should answer:

> Apa yang harus gue kerjakan sekarang?

Examples:

- Review 2 HET exceptions for SDN 30.
- Complete SIPLah purchase for SDN 71.
- 4 orders are ready to be consolidated into a vendor batch.
- Goods for SD Inpres 49 arrived and need checking.
- SDN 65 is fully paid and its 10% benefit is now eligible.

Tasks should link directly into the executable workflow rather than merely open a generic record.

### Orders — context by school/order

Answers:

> Sekolah ini sekarang gimana, apa yang sudah beres, apa yang masih kurang, dan apa next action-nya?

### Pipeline — secondary operational overview

Answers:

> Banyak order gue sedang mandek di bagian mana?

Pipeline is useful but must not dominate the product.

### Vendor — batch execution workspace

Answers:

> Pesanan sekolah mana yang sudah siap direkap, apa total buku yang harus disiapkan vendor, dan status batch ini sudah sampai mana?

## Prototype scope

### In scope

- interactive frontend prototype
- realistic demo domain/state
- state mutation from user actions
- local persistence/reset
- Home / Work Queue
- Orders Explorer
- Order Workspace
- New Order Intake simulation
- ARKAS extraction simulation
- HET exception review
- SIPLah operational checklist
- Vendor Batch Builder
- vendor item aggregation with school breakdown
- actual client-side vendor recap Excel export if practical
- Vendor Batch lifecycle
- goods arrival flow
- fulfillment summary from mocked external tracker
- school payment recording
- automatic 10% benefit eligibility after LUNAS
- benefit payment recording
- Next Action engine
- timeline/manual notes
- responsive desktop + mobile

### Explicitly out of scope

- production backend
- real SIPLah integration
- storing school SIPLah passwords
- full OCR/AI extraction service
- complete accounting system
- general company cashflow/accounting
- profit analytics
- CRM/sales automation beyond order intake context
- advanced RBAC
- multi-user approvals
- AI chatbot
- complex BI dashboards
- production-grade auth/security implementation
- rebuilding the detailed Kelengkapan Buku Tracker

## Lifecycle model

Use a lifecycle stage only for broad position:

- INTAKE
- HET_REVIEW
- SIPLAH
- VENDOR
- GOODS_ARRIVED
- DISTRIBUTION
- COMPLETION
- CLOSED

Do not force financial, vendor, fulfillment, and SIPLah states into this one stage.

## Closure rule represented in the prototype

An order can be considered Closed when the required company-side checkpoints are complete:

- goods fully received/accepted by school
- SIPLah/admin complete
- school payment LUNAS
- school benefit PAID

Supplier payment may remain outstanding and must not block Closed.

## Success criteria for the prototype

The prototype is successful if a reviewer can:

- open Home and understand the next important work within ~5 seconds
- open an order and determine what happened, what is missing, and what comes next within ~10 seconds
- resolve an HET exception without reviewing every successful item
- take multiple eligible school orders and generate a coherent vendor recap without manual re-entry
- distinguish vendor batch draft/generated/sent/processing/arrived states
- record school LUNAS and immediately see the benefit become eligible
- refresh the app and keep demo state
- reset the demo to the canonical scenarios

## Product rule

> Prefer executable workflows over passive status displays.
