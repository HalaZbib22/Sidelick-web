# Backend Standards (Express / PostgreSQL)

## API shape

- Every response uses the envelope from `lib/response.ts` (`ok` / `fail` and
  the helpers). Handlers validate input with **zod** before touching the DB.
- Privacy-preserving denials: when a caller shouldn't know a resource exists,
  return 404 (`notFoundError`), not 403.
- New endpoints get a path constant in the frontend's `lib/paths.ts` in the
  same PR — the two sides never drift.

## Database

- **Parameterized queries only.** String-interpolated SQL is an automatic PR
  rejection.
- Constraints enforce invariants, not just code: CHECKs for enums, partial
  unique indexes for "one open X per Y", FKs with deliberate ON DELETE
  behavior (RESTRICT for financial rows).
- Idempotency by design: `IF NOT EXISTS`, `ON CONFLICT`, status-guarded
  UPDATEs. Any operation that could run twice must be safe to run twice.
- `schema.sql` is the readable source of truth and is updated in the same PR
  as its migration. Migrations are numbered, ordered, and idempotent.
- **Migrations ship before or with the code that reads the new schema.**
  Deploying code that queries a column before its migration runs takes the
  whole API down (this happened; see devops.md).

## Money rules (strictest tier)

- All pricing is server-authoritative (`lib/pricing.ts`). The client never
  sends an amount the server trusts.
- Every money movement writes an auditable row (payments, walker_ledger,
  commission_settlements). Balances are always derivable by summing rows —
  never stored counters that can drift.
- Money-touching changes require a test (see testing.md) and extra review.

## Enforcement lives server-side

UI gating is UX; the backend is the boundary. Species rules, verification
gates, debt blocks, role checks — all enforced in routes/middleware even when
the UI already prevents the action.

## Code organization

- Route files stay thin; multi-step domain logic moves to `lib/` modules that
  return discriminated-union results (`{ok:true,...} | {ok:false, code, message}`)
  — see `lib/disputes.ts` / `lib/petReports.ts` for the reference pattern.
- A route file approaching ~500 lines is due for splitting.
- Zero-dependency bias: prefer a few dozen lines of our own code over a new
  npm package (each package is supply-chain surface). New dependencies need a
  reason in the PR description.

## Definition of done

- [ ] zod-validated input; envelope responses; parameterized SQL
- [ ] Migration + schema.sql updated together; idempotent
- [ ] Server-side enforcement for anything the UI gates
- [ ] Money changes: audit rows + tests
- [ ] No new dependency without justification
