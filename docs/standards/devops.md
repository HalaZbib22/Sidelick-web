# DevOps & Operations Standards

## Environments & deploys

- One production server; **`main` is the only deploying branch.** Never
  re-add a second deploy trigger — two branches racing to one server ships
  stale code over new (this happened).
- Release order, always: **1) run migrations, 2) merge develop → main.**
  Code that reads a schema must never arrive before the schema. (Goal state:
  migrations run automatically as a deploy step — until then, the
  "Run database migrations" workflow is mandatory before every release that
  includes one.)
- Server maintenance without SSH goes through the maintenance workflows
  (create-admin, run-migrations). New one-off server tasks get a workflow,
  not a copy-pasted snippet — workflows are auditable and repeatable.

## The gaps being closed (priority order)

1. **Database backups** — nightly `pg_dump` shipped off the server, restore
   procedure tested. Until this exists, treat the DB as one disk failure away
   from total loss. Highest-priority item in the company.
2. **Error monitoring** — Sentry (or equivalent) on backend + frontend; deploy
   notifications; uptime check on `/api/health`.
3. **Deploy verification** — replace `sleep 10` with a real health-check gate
   and automatic rollback on failure.
4. **Server ownership** — production must run in a company-controlled hosting
   account; SSH by key, not password; credentials in a password manager.

## Configuration

- All config via environment; the compose file holds no real values. New env
  vars are added to `.env.docker.example` (placeholder), the GitHub secret
  set, and the deploy workflow's generated file — in the same PR.
- Production fails fast on missing critical config (JWT_SECRET pattern);
  prefer a crash at boot over a silent insecure fallback.

## Database operations

- Postgres stays bound to localhost — never expose 5432 publicly. Remote
  access is SSH-tunnel or workflow only.
- Destructive SQL (DELETE/UPDATE without WHERE-by-id, DROP) requires a
  backup taken first and a second look, even from admins.

## Observability floor

- Backend errors log with enough context to act on (route, user id, error).
- Every incident's postmortem answers: how would we have detected this
  automatically? Then we add that detection.

## Definition of done

- [ ] Migration ordering respected (schema before code)
- [ ] New env vars wired through example + secret + workflow together
- [ ] No new public ports; no credentials outside secrets
- [ ] Rollback story exists for the change ("how do we undo this?")
