# Testing Standards

Current state: no automated tests — the single biggest gap between this
codebase and an 8+/10. This doc defines the floor we build toward, so every
new PR raises coverage instead of debt.

## Tooling (when introduced)

- **Vitest** for unit tests (fast, TS-native, works for both tiers).
- **Supertest** against the Express app for API tests, with a disposable
  Postgres (docker) seeded per run.
- CI runs the suite on every PR; a red suite blocks merge.

## Priority ladder — what to test first

1. **Money math (mandatory, before anything else):**
   - `lib/pricing.ts` — a quote per catalog service, shared-walk discount,
     per-pet fees, distance fee, payout floor. Golden-number tests: exact
     expected totals, not "greater than zero".
   - Ledger invariants — cash commission accrual, refund reversal, settlement
     adjustment: balance always equals the sum of rows; never negative from
     a normal flow; idempotent operations stay idempotent when run twice.
2. **Auth boundary:** cookie parsing, password-change token invalidation,
   role gates (user hitting admin route → 403/404), debt gate on accept.
3. **Booking rules:** species enforcement (cat + walk rejected), service
   offering checks, segment generation per service type (daycare day_index,
   boarding overnight span).
4. **Upload validation:** magic-byte acceptance/rejection per format.

## Rules going forward

- **Any PR that changes money math ships with tests.** No exceptions, no
  "will add later".
- Bug fixes add a regression test that fails without the fix, when the bug
  was logic (not styling).
- Tests use builders/factories for fixtures — no 50-line inline objects.
- Test behavior, not implementation: call the route/function, assert the
  outcome (DB rows, response, balance), not internal calls.

## What we deliberately don't test (yet)

- Pixel-level UI and styling — the design review covers it.
- Third-party integrations behind provider seams — the seams get a fake
  provider; the real integration is verified manually at integration time.

## Definition of done

- [ ] Money-path change → golden-number test included
- [ ] Logic bug fix → regression test included
- [ ] Suite green in CI before merge
