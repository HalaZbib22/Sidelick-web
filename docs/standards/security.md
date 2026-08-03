# Security Standards

The repo is **public**. Assume every line of code, config, and CI log is read
by an adversary. Security posture is only as strong as its weakest recent PR.

## Authentication & sessions

- The JWT lives in an **httpOnly, SameSite=Lax cookie** (Secure in prod).
  Tokens never touch JavaScript, localStorage, or response bodies. The client
  keeps only a non-sensitive `{userId, role}` display hint.
- `requireAuth` re-checks the DB each request: account exists, role is fresh,
  token predates no password change. Password reset invalidates all sessions.
- JWT: HS256 pinned on sign and verify; production refuses to boot without a
  strong `JWT_SECRET` (≥32 chars). Never weaken the boot check.
- Rate limits on credential endpoints stay in place; sign-in failures are
  uniform ("Invalid credentials") with dummy-hash timing equalization.

## Secrets

- Real secrets exist in exactly two places: GitHub Actions Secrets and the
  server's generated `.env.docker`. **Never** in the repo — `.example` files
  use obvious placeholders.
- Generate secrets with `openssl rand -base64 48`. Rotate any secret that ever
  appears in a chat, log, screenshot, or terminal paste.
- Every secret has a documented owner and lives under company-controlled
  accounts (see devops.md on server ownership).

## Uploads (the hardened pattern — don't regress it)

- Filenames: `crypto.randomUUID()`. Extension from **our** mimetype map, never
  the client's filename. Magic-byte validation after write; delete on fail.
- Public uploads are served with `nosniff` + a sandboxing CSP so nothing from
  that directory can ever execute. Private uploads stay auth-gated.
- URLs built from `PUBLIC_API_URL`, never the Host header.

## Headers & CSP

- The strict production CSP is a feature. When something breaks under it
  (e.g. a library loading assets from a third-party CDN), fix the dependency
  (bundle the asset), don't loosen the policy. Dev-only relaxations are
  gated on `NODE_ENV === "development"`.

## Dependencies

- Dependabot runs in security-only mode: merge security PRs promptly; routine
  and major bumps are deliberate, reviewed migrations (a TS major once shipped
  a whole new compiler — CI caught it; keep CI as the gate).
- Verify unusual publisher warnings against the npm registry before merging.

## Incident hygiene

- Leaked credential (even suspected): rotate immediately; password-change
  invalidation kills live sessions.
- After any incident, the fix includes the *systemic* change that prevents the
  class of bug, not just the instance.

## Definition of done

- [ ] No secrets/tokens in code, tests, fixtures, or logs
- [ ] New endpoints behind the right middleware (auth/role/verified/debt gates)
- [ ] New upload paths follow the hardened pattern
- [ ] CSP untouched (or narrowed); any exception is dev-gated and justified
