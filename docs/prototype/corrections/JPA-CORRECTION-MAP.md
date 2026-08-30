# JPA Post-Audit Correction Map

Status: JPA-COR-07–12 implemented; Review Gate B pending
Baseline: `00a747e` on `prototype/pass-5-final-integration`  
Audit source: `outputs/jpa-ui-ux-audit/JPA-Operations-Workspace-UI-UX-Audit.md`  
Design plan: `outputs/jpa-ui-ux-audit/JPA-Graph-First-Correction-Plan.md`
Decision provenance: #1–#3 were explicitly reconfirmed by the user on 2026-08-29; #4 was explicitly confirmed by the user on 2026-08-30 before JPA-COR-11.

This is the canonical post-audit task map. Detailed implementation cards are assets linked from each prototype ticket. Execute one numbered ticket per agent session unless the map explicitly describes a review gate.

## Working agreement for every implementation agent

1. Read repository `AGENTS.md` and every file under `docs/prototype/` before editing.
2. Read this entire map and the assigned detailed card.
3. Inspect `git status --short`, the current branch, relevant source, existing tests, and similar UI patterns before patching.
4. Preserve all unrelated work and implement only the assigned card.
5. Keep domain logic outside page components and preserve versioned local persistence/reset behavior.
6. Run the smallest relevant automated checks, then `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before handoff.
7. Interact with the running application in a real browser. Source review and screenshots alone are not sufficient.
8. Verify the affected flow on desktop and at 390 px unless the card explicitly marks a viewport as not applicable.
9. Return: intended graph, files changed, state/schema changes, checks and browser scenarios run, evidence, residual risks, and rollback note.
10. Stop when the assigned card is complete. Do not begin the next ticket automatically.

## Invariants across all tickets

- Home remains the primary work queue; Pipeline remains secondary.
- HET remains exception-first.
- ARKAS, reviewed HET, and final SIPLah amounts remain distinct.
- Workbook generation never implies sending.
- Vendor arrival remains allocation-aware per school/order.
- Parallel obligations remain independently visible and snoozable.
- Stale/error/conflict tracker refresh preserves last known good quantities.
- Detailed reconciliation remains in the external tracker.
- Supplier payment does not block school-order closure.
- No fake supplier prices, costs, or margins are introduced.
- No production backend, authentication, RBAC system, or external notification integration is added in this prototype correction cycle.

## Priority and phase order

```text
Phase 0 - product decisions
  #1 -> #7
  #2 -> #8
  #3 -> #9
  #4 -> #11 and #13
  #5 -> #16
  #6 -> #17

Phase 1 - field-test blockers
  #7 -> #10
  #8
  #9
  #11
  #7 + #8 + #9 + #10 + #11 -> Review Gate A

Phase 2 - operational refinement
  #10 + #11 -> #12
  #4 + #7..#12 -> #13
  #14
  #15
  #5 -> #16
  #6 -> #17
  #12..#17 -> Review Gate B

Phase 3 - release proof
  #7..#17 -> #18
```

Within Phase 1, urgency order is `#7`, `#8`, `#9`, `#10`, `#11`. Tickets #8, #9, and #11 may run in parallel after their decision gates, but #10 should see the final obligation semantics from #7. Within Phase 2, #14-#17 may run in parallel if agents avoid overlapping shared presentation files.

## #1: What does an unscheduled passive wait mean?

Blocked by: none  
Type: Discuss  
Priority: P1 policy gate

### Question

When school payment is `UNPAID`, or a Vendor Batch is `PROCESSING`, should missing follow-up scheduling be silent, automatically dated, or visibly incomplete?

### Answer

Confirmed: keep `PROCESSING` itself passive, but create one non-snoozable **Atur tindak lanjut** obligation when no date exists. Suggest a date, require explicit operator confirmation, then expose the actual follow-up action only when due. This reconciles the old Review Gate 1 rule with audit UX-001, UX-002, and UX-014 without inventing a stale threshold or notification integration.

## #2: What is the prototype closure and reopen policy?

Blocked by: none  
Type: Discuss  
Priority: P1 policy gate

### Question

Who may close/reopen an order, what reason is required, and how should recovery be represented without building production RBAC?

### Answer

Confirmed: closing uses a mandatory review and explicit confirmation; reopening is available through an explicit prototype capability, requires a reason, and appends a Timeline event. No authentication or role-management system is needed in the prototype.

## #3: What makes a school eligible for a new order?

Blocked by: none  
Type: Discuss  
Priority: P1 policy gate

### Question

Is **Demo Closed School** an inactive institution or merely a school with a historical closed order, and where should school eligibility live?

### Answer

Confirmed: model school eligibility explicitly rather than inferring it from an order's `CLOSED` stage. New Order always starts unselected; inactive schools are shown only as historical, non-selectable context.

## #4: Which operator-facing terms are canonical?

Blocked by: none  
Type: Discuss  
Priority: P2 policy gate

### Question

Which English domain terms are familiar enough to keep, and which raw statuses must be translated consistently across UI, Timeline, and XLSX?

### Answer

Confirmed: use the recommended operator vocabulary without renaming domain/internal enums. Keep ARKAS, HET, SIPLah, Surat Pesanan, Invoice, BAST, and Vendor Batch. Use **Sedang diproses vendor**, **Tiba sebagian**, **Benefit wajib dibayar**, **Belum wajib dibayar**, **Belum tiba** only for goods-arrival status, **Belum ditetapkan**, **Rekap dibuat, belum dikirim**, **Otomatis**, and **Catatan operator** in the appropriate operator-facing contexts. Keep the mapping centralized so pages do not drift; gross/net and derived values require plain-language explanations.

## #5: What metadata makes the Vendor XLSX send-ready?

Blocked by: none  
Type: Discuss  
Priority: P2 policy gate

### Question

Which vendor identity, contact, delivery, preparation-date, and operator fields must appear in the workbook, and where does that data come from in the prototype?

### Answer

Pending user confirmation. Recommended minimum: vendor name, operator/contact note, delivery note/address, local preparation date, batch ID, consistent Indonesian labels, and existing quantities. Do not invent commercial figures.

## #6: How should a lower cumulative tracker snapshot be classified?

Blocked by: none  
Type: Discuss  
Priority: P2 policy gate

### Question

Should the workspace reject, quarantine, or require reconciliation when incoming cumulative delivery is lower than the last known good value?

### Answer

Pending user confirmation. Recommended: quarantine the incoming value, preserve the last known good cache, mark a distinct conflict state/message, and direct the operator to reconcile in the external tracker. The current domain behavior already preserves good data; the missing part is deterministic UI exposure.

## #7: Can Finance and Vendor waits become impossible to forget?

Blocked by: #1  
Type: Prototype  
Priority: P1 - highest  
Detailed card: [JPA-COR-07 - Reminders and Passive Waits](./JPA-COR-07-reminders-passive-waits.md)

### Question

Can valid reminders be saved and can every unscheduled `UNPAID`/`PROCESSING` wait expose an explicit setup obligation without duplicating due actions?

### Answer

Implemented with targeted regression coverage: unscheduled active `UNPAID` payment waits expose one non-snoozable **Atur tindak lanjut pembayaran** obligation; `PROCESSING` and partial-arrival vendor waits expose one grouped, non-snoozable **Atur tindak lanjut vendor** obligation per batch, scoped to members that have not arrived fully. Confirmed dates are persisted as local calendar days, become due actions only when reached, and are removed when payment is confirmed or the batch fully arrives. Reminder save failures retain the entered date and expose retry behavior. Targeted automated and browser checks cover unscheduled, partial, due, resolved, and persistence-failure paths; the full Review Gate A/COR-18 scenario matrix remains pending.

## #8: Can order closure be deliberate and recoverable?

Blocked by: #2  
Type: Prototype  
Priority: P1  
Detailed card: [JPA-COR-08 - Safe Closure and Recovery](./JPA-COR-08-safe-closure-recovery.md)

### Question

Can closure require review, remain idempotent, explain non-blocking supplier payment, produce correct closed-state copy, and support policy-approved recovery?

### Answer

Implemented and verified: closure now uses a domain-derived blocking checklist for fulfillment, school acceptance, SIPLah administration, school payment, and benefit; supplier payment is shown separately as non-blocking. Eligible orders open a review modal before closing, confirmation is explicit and idempotent, closed workspaces expose accurate read-only guidance, and approved reopen requires a non-empty reason, restores a derived active stage, and appends a Timeline event. Automated checks and interactive desktop/390 px browser verification passed.

## #9: Can New Order guarantee an explicit eligible school context?

Blocked by: #3  
Type: Prototype  
Priority: P1  
Detailed card: [JPA-COR-09 - New Order School Context](./JPA-COR-09-new-order-school-context.md)

### Question

Can no browser path reach ARKAS intake with an implicit, inactive, duplicate, or stale school context?

### Answer

Implemented and verified: New Order now starts with no school context, uses a persisted explicit `ACTIVE`/`INACTIVE` school registry, keeps historical schools visible but non-selectable, requires explicit identity confirmation before extraction, detects normalized duplicate names, clears stale mode state, and stores a stable school ID on created orders. State v6 migrates deterministically to the new registry. Automated checks and interactive desktop/390 px browser verification passed.

## #10: Are critical obligations visible at normal desktop width?

Blocked by: #7  
Type: Prototype  
Priority: P1  
Detailed card: [JPA-COR-10 - Desktop Operational Visibility](./JPA-COR-10-desktop-operational-visibility.md)

### Question

Can Orders expose payment/benefit signals and can Pipeline expose later stages without accidental hidden horizontal content?

### Answer

Implemented with targeted viewport regression coverage: Orders now uses a four-column desktop table with a compact six-signal summary, keeping school identity, lifecycle position, Next Action, HET/SIPLah/Vendor/Barang, Bayar, and Benefit visible at 1366px and the wide desktop baseline without horizontal table overflow. Pipeline now uses an intentional responsive grid that exposes all seven lifecycle stages without horizontal scrolling; empty stages remain named and closed orders remain secondary. Long school names wrap safely, keyboard-focusable order links remain reachable, and the existing mobile card mode stays intact at 390px. Browser checks covered 1366px, 1536px, 390px, and a 200% CSS viewport simulation; the full Review Gate A/COR-18 scenario matrix remains pending.

## #11: Can operators recover from critical form errors in Indonesian?

Blocked by: #4  
Type: Prototype  
Priority: P1/P2  
Detailed card: [JPA-COR-11 - Localized Form Validation](./JPA-COR-11-localized-form-validation.md)

### Question

Can critical forms use local inline errors, clear stale errors on correction, and avoid native English validation bubbles?

### Answer

Implemented with shared inline error rendering and controlled validation: critical payment, benefit, HET override/reopen, reminder, New Order, SIPLah transaction, closure, and Timeline inputs now use Indonesian field errors, stable error IDs, `aria-invalid`/`aria-describedby`, first-invalid focus, explicit `noValidate` forms, stale-error clearing, and separate action/persistence feedback. Decision #4 operator labels are centralized in `src/domain/presentation-labels.ts` without changing canonical enum values. Automated regression coverage includes desktop and 390 px browser paths for mismatch correction, conditional TRANSFER/CASH reference behavior, HET reason, missing New Order context/file, Timeline note, persistence failure retention, and mobile modal usability.

## Review Gate A: field-test blocker review

Blocked by: #7, #8, #9, #10, #11

Stop and interactively verify all P1 corrections on desktop and 390 px. If any passive wait is silent, closure is unreviewed, school context is implicit, critical desktop content is hidden, or native validation controls a critical flow, do not begin Phase 2.

## #12: Can mobile operators discover and retain workspace context?

Blocked by: #10, #11  
Type: Prototype  
Priority: P2/P3  
Detailed card: [JPA-COR-12 - Mobile Workspace Navigation](./JPA-COR-12-mobile-workspace-navigation.md)

### Question

Can a one-handed operator discover every order section and filter while preserving selected context and safe-area spacing at 390 px?

### Answer

Implemented with an explicit mobile section picker and filter picker: all seven order workspace sections remain discoverable at 390 px, the selected section stays visible and URL-backed, browser back/forward/reload preserve context, and desktop tabs remain unchanged. Narrow Orders filters use the same explicit picker pattern. Mobile top/bottom safe-area spacing, modal footer reachability, and secondary Reset Demo Data treatment were added. Automated and interactive browser checks cover 390 px and desktop regression paths; the remaining Phase 2/COR-18 scenario matrix is pending.

## #13: Can UI and Timeline speak one operator language?

Blocked by: #4, #7, #8, #9, #10, #11, #12  
Type: Prototype  
Priority: P2/P3  
Detailed card: [JPA-COR-13 - Operator Terminology](./JPA-COR-13-operator-terminology.md)

### Question

Can one presentation vocabulary replace raw enums and mixed technical copy without changing canonical domain values?

### Answer

Pending implementation and interactive browser proof.

## #14: Can HET alternatives be discovered before free-text search?

Blocked by: none  
Type: Prototype  
Priority: P2  
Detailed card: [JPA-COR-14 - HET Alternative Discovery](./JPA-COR-14-het-alternative-discovery.md)

### Question

Can the operator see ranked, meaningful replacement candidates immediately while preserving exception-first review and immutable ARKAS source data?

### Answer

Pending implementation and interactive browser proof.

## #15: Can SIPLah distinguish procurement blockers from later administration?

Blocked by: none  
Type: Prototype  
Priority: P2  
Detailed card: [JPA-COR-15 - SIPLah Document Hierarchy](./JPA-COR-15-siplah-document-hierarchy.md)

### Question

Can Surat Pesanan remain visibly primary while Invoice/Kwitansi/BAST become one secondary **Administrasi menyusul** group?

### Answer

Pending implementation and interactive browser proof.

## #16: Can the Vendor workbook be sent without manual cleanup?

Blocked by: #5  
Type: Prototype  
Priority: P2  
Detailed card: [JPA-COR-16 - Send-Ready Vendor Workbook](./JPA-COR-16-vendor-workbook-send-ready.md)

### Question

Can the workbook gain approved metadata, local dates, consistent labels, and print-ready structure while preserving exact totals and generation-versus-send semantics?

### Answer

Pending implementation and workbook/browser proof.

## #17: Can a cumulative tracker conflict be reproduced in the UI?

Blocked by: #6  
Type: Prototype  
Priority: P2  
Detailed card: [JPA-COR-17 - Tracker Conflict Fixture](./JPA-COR-17-tracker-conflict-fixture.md)

### Question

Can a reviewer trigger a lower-cumulative result without editing localStorage and see last known good data preserved with an actionable explanation?

### Answer

Pending implementation and interactive browser proof.

## Review Gate B: refinement review

Blocked by: #12, #13, #14, #15, #16, #17

Stop and verify that refinements reduced comprehension and recovery cost without weakening any invariant. Compare the corrected surfaces with the audit evidence at the same states and viewports.

## #18: Does the implemented graph pass the full operational regression?

Blocked by: #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #17  
Type: Prototype  
Priority: release gate  
Detailed card: [JPA-COR-18 - Full Browser Regression](./JPA-COR-18-release-browser-regression.md)

### Question

Do all 15 canonical workflows, relevant void/error states, persistence, workbook output, desktop behavior, and 390 px mobile behavior match the intended graph?

### Answer

Pending final interactive browser audit. No field-test recommendation is allowed before this ticket is resolved.
