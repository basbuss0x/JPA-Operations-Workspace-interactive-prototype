# JPA Operations Workspace — Interactive Prototype

Interactive R&D prototype for an operations workspace that helps manage school procurement orders from ARKAS intake through HET validation, SIPLah purchasing, vendor batching, goods arrival, school distribution, payment, school benefit, and completion.

This repository is intentionally a prototype. The goal is to validate workflow, information architecture, productivity gains, and interaction design before committing to production architecture.

## Product principle

> Prefer executable workflows over passive status displays.

The prototype should reduce what the operator must remember, copy, calculate, re-enter, and manually follow up.

## Product documentation

The prototype source of truth lives under `docs/prototype/`.

Read those documents before implementing features.

## Run the final integrated prototype

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Implemented routes:

- `/` — Home / Kerjakan Sekarang
- `/orders` — searchable and filterable Orders Explorer
- `/orders/new` — deterministic school-order and ARKAS intake
- `/orders/:orderId` — route-aware Order Workspace tabs
- `/orders/:orderId/arkas` — exception-first HET review and approval
- `/orders/:orderId/siplah` — SIPLah checkpoints and document workflow
- `/vendor-batches/new` — eligible-order selection and derived vendor recap preview
- `/vendor-batches` — operational Vendor Batch list
- `/vendor-batches/:batchId` — explicit lifecycle, XLSX recap, reminder, and targeted arrival actions
- `/orders/:orderId?tab=distribution` — goods check and cached external fulfillment summary
- `/orders/:orderId?tab=finance` — gross/net school payment, benefit, and explicit closure workflow
- `/orders/:orderId?tab=timeline` — system history and manual notes
- `/pipeline` — lifecycle-derived, secondary cross-order overview with compact action context

Prototype state is versioned and persisted under the `jpa-operations-prototype` localStorage key. Use **Reset Demo Data** in the app shell to restore all canonical scenarios.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build

# Browser route/persistence/mobile smoke tests
npx playwright install chromium
npm run test:e2e
```

The integrated prototype covers TASK 00–17 and stops at the Final Prototype Review Gate. See [`docs/prototype/FINAL-WALKTHROUGH.md`](docs/prototype/FINAL-WALKTHROUGH.md) for the demo journeys and the explicit production boundary.

This validates workflow and domain interaction, deterministic simulated integrations, local demo persistence/reset, and real client-side XLSX export. It is **not production-ready**: there is no backend/database, authentication/authorization, real file storage, SIPLah or tracker integration, multi-user concurrency, production audit/security model, or deployment architecture.
