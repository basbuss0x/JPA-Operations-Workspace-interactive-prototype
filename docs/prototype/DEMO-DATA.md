# Demo Data — Canonical Prototype Scenarios

Use these scenarios as the canonical reset state for the interactive prototype. Exact school names and values are demo fixtures; the important part is that each order represents a distinct operational condition.

## Scenario A — HET mismatch blocker

### School
SDN 30 Ambon

### State
- Stage: HET_REVIEW
- ARKAS uploaded/extracted
- 28 items detected
- 26 auto-matched
- 2 items need review
- Example total ARKAS: Rp18.940.000
- Example total HET: Rp19.360.000
- Difference: Rp420.000
- SIPLah: not started
- Vendor: none
- School payment: UNPAID
- Benefit: NOT_ELIGIBLE

### Expected next action
`Review 2 HET exceptions`

### Example exceptions
1. Price mismatch
   - ARKAS title: Buku Matematika Kelas V
   - ARKAS price: Rp78.000
   - Best master match: Matematika untuk SD/MI Kelas V
   - HET: Rp82.000

2. Ambiguous/no confident match
   - ARKAS title: Pendidikan Agama / abbreviated title
   - User must choose a product master match or manually override

---

## Scenario B — Ready for SIPLah

### School
SDN 71

### State
- Stage: SIPLAH
- ARKAS: confirmed
- HET: APPROVED
- SIPLah access available: true
- order placed: false
- Surat Pesanan: unavailable
- Vendor: none
- School payment: UNPAID
- Benefit: NOT_ELIGIBLE

### Expected next action
`Belanjakan pesanan di TokoLadang/SIPLah`

---

## Scenario C — SIPLah complete, ready for vendor batch

### School
SDN 40 Ambon

### State
- Stage: SIPLAH
- HET: APPROVED
- SIPLah access available: true
- order placed: true
- SIPLah order number present
- Surat Pesanan available: true
- Surat Pesanan sent to school: true
- not currently in a vendor batch
- School payment: UNPAID
- Benefit: NOT_ELIGIBLE

### Expected next action
`Masukkan ke Vendor Batch`

### Example order items
- Matematika Kelas V — qty 20
- Bahasa Indonesia Kelas V — qty 15
- IPAS Kelas V — qty 20

---

## Scenario D — Another vendor-batch-eligible school

### School
SLB Batu Merah

### State
- Stage: SIPLAH
- HET: APPROVED
- SIPLah checklist complete
- not in vendor batch
- School payment: UNPAID

### Example order items
Include at least one product also ordered by SDN 40 so aggregation can be demonstrated.

Example:
- Matematika Kelas V — qty 8
- Bahasa Indonesia Kelas V — qty 6

### Expected next action
`Masukkan ke Vendor Batch`

---

## Scenario E — Vendor processing

### School
SD Inpres 49 Ambon

### State
- Stage: VENDOR
- SIPLah: complete
- Vendor batch: VB-2026-009
- Batch status: PROCESSING
- Goods not yet arrived
- School payment: UNPAID
- Benefit: NOT_ELIGIBLE

### Expected next action
`Tunggu / follow-up vendor bila perlu`

---

## Scenario F — Goods arrived, needs checking/delivery

### School
SDN 239 MT

### State
- Stage: GOODS_ARRIVED
- Vendor batch: VB-2026-008
- Batch/order goods arrived at JPA
- pre-delivery check not yet completed
- School payment: UNPAID
- Benefit: NOT_ELIGIBLE

### Expected next action
`Cek barang dan jadwalkan pengantaran`

---

## Scenario G — Partial distribution

### School
SDN 65 Ambon

### State
- Stage: DISTRIBUTION
- SIPLah: complete
- vendor goods received
- mocked Kelengkapan Tracker:
  - orderedQty: 314
  - deliveredQty: 247
  - remainingQty: 67
  - progressPercent: ~79
  - problemCount: non-zero
  - syncStatus: OK
- school payment may be LUNAS to demonstrate state independence
- benefit can already be PAID or remain ELIGIBLE depending on the workflow being tested

### Expected next action
`Lanjutkan pemenuhan / antar sisa 67 buku`

The detailed missing-title/replacement workflow is external to this prototype.

---

## Scenario H — School paid, benefit eligible

### School
SDN 68 Ambon

### State
- Stage: COMPLETION
- goods accepted by school
- SIPLah/admin complete
- Invoice/final ARKAS amount: Rp24.350.000
- School payment: LUNAS
- Payment date/method present
- Benefit: ELIGIBLE
- Derived benefit amount: Rp2.435.000

### Expected next action
`Bayar benefit Rp2.435.000`

After recording benefit payment, completion readiness should update.

---

## Scenario I — Fully completed/closed reference

### School
Demo Closed School

### State
- Stage: CLOSED
- HET approved
- SIPLah complete
- goods fully accepted
- School payment: LUNAS
- Benefit: PAID
- supplier payment may intentionally remain PARTIAL to prove supplier liability does not block order closure

### Expected next action
None. Order should be treated as completed/read-only in the prototype unless a later reopen experiment is explicitly added.

---

# Canonical Vendor Batch fixture

## VB-2026-009

Status: PROCESSING

Contains at least:
- SD Inpres 49 Ambon
- one additional demo order if useful

## New batch experiment

SDN 40 + SLB Batu Merah should both initially be eligible for a newly created batch.

When selected together, the prototype should derive aggregate quantities such as:

```text
Matematika Kelas V
Total: 28
- SDN 40: 20
- SLB Batu Merah: 8

Bahasa Indonesia Kelas V
Total: 21
- SDN 40: 15
- SLB Batu Merah: 6
```

The user should be able to generate an Excel recap from this derived data.

# Reset behavior

`Reset Demo Data` must restore these scenarios and remove local prototype changes such as:

- resolved HET exceptions
- completed SIPLah checkpoints
- newly created vendor batches
- recorded arrivals
- recorded school payments
- benefit payments
- snoozed/manual next actions
- timeline notes added during exploration
