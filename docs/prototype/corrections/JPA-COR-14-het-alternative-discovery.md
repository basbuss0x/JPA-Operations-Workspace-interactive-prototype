# JPA-COR-14 - HET Alternative Discovery

Phase: 2 - operational refinement  
Priority: P2  
Blocked by: none  
Finding: UX-008  
Primary route: `/orders/:orderId/arkas`

## Outcome

When an HET match is ambiguous or wrong, the operator immediately sees meaningful replacement candidates and can compare them before using free-text search. ARKAS source values remain immutable and final HET approval remains explicit.

## Target graph

```text
HET exception
  -> open Pilih produk lain
    -> ranked alternatives visible immediately
      -> compare current suggestion and candidate
        -> choose candidate
          -> exception resolved but review still unapproved
    -> search for more when needed
```

## Starting points

- `src/routes/het-review-page.tsx`
- `src/domain/intake.ts`
- `src/data/product-master.ts`
- `src/domain/het-review.test.ts`
- `src/domain/intake.test.ts`
- `src/styles/index.css`
- `tests/e2e/prototype.spec.ts`

## Implementation requirements

1. Preserve the current exception-first layout and immutable ARKAS/source comparison.
2. When the product editor opens, show a small deterministic ranked alternative set before the operator types.
3. Clearly identify the current suggestion and avoid returning it as the only alternative.
4. Rank using existing product-master data and transparent, simple criteria. Do not add AI/search services or speculative fuzzy-search dependencies.
5. Keep free-text title/code search for extended results.
6. Candidate rows must expose enough title/code/HET context to choose safely.
7. Choosing another product resolves only that item and does not auto-approve the HET review.
8. Reopening and editing a previously resolved item uses the same candidate behavior.

## Acceptance criteria

- [ ] **Pilih produk lain** shows the current suggestion plus at least one meaningful alternative for the canonical ambiguous Religion item before typing.
- [ ] Current suggestion is explicitly labeled and not confused with alternatives.
- [ ] Search still finds product by title and code.
- [ ] Empty/no-result search has clear recovery copy.
- [ ] Selecting an alternative preserves ARKAS title, quantity, and price.
- [ ] Reviewed HET total updates correctly.
- [ ] Final approval remains separately confirmed.
- [ ] Reopened/resolved item editing behaves consistently.
- [ ] Candidate comparison is readable and tappable at 390 px.

For the canonical Religion fixture, the current Product Master contains two relevant options: `BK-PAI-5` and `BK-PAK-5`. The acceptance proof is therefore the current `BK-PAI-5` suggestion plus the meaningful `BK-PAK-5` alternative; the picker must not pad the recommended list with unrelated class/price matches. Additional products remain discoverable through explicit title/code search.

## Automated verification

Cover deterministic ranking, no duplicate candidate codes, current-suggestion labeling, selection transition, immutable source values, recalculated reviewed total, and no auto-approval. Extend the canonical E2E HET journey.

Run all standard checks and `npm run test:e2e`.

## Mandatory browser verification

Use the canonical Religion ambiguity. Open alternatives without typing, compare candidates, search by `Agama` and code, select BK-PAK-5, verify totals and disabled/explicit final approval, then reopen and edit at desktop and 390 × 844.

## Stop conditions

Stop if meaningful ranking requires product metadata that does not exist. Return the minimum additional fixture field needed rather than inventing opaque scoring or adding a synthetic third Religion product.
