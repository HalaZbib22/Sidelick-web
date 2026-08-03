# Sidelick Engineering Standards

These documents define the quality bar for all Sidelick code. They exist so the
codebase's current strengths survive growth, and its known gaps close instead
of multiplying. Every PR is measured against them — by humans and by AI
assistants working on this repo.

## The files

| Doc | Covers |
|---|---|
| [git-workflow.md](git-workflow.md) | Branches, PRs, releases, commits |
| [frontend.md](frontend.md) | React/Next.js patterns, state, errors |
| [design.md](design.md) | The Sidelick design language & UX rules |
| [backend.md](backend.md) | API, database, migrations, money |
| [security.md](security.md) | Auth, uploads, secrets, headers |
| [devops.md](devops.md) | Deploys, environments, backups, monitoring |
| [testing.md](testing.md) | What must be tested and how |

## The quality bar

Current self-assessment: **7/10**. The path to 8+ is not more features — it is
closing these known gaps, in priority order:

1. **Automated database backups** — highest priority; data loss is unrecoverable.
2. **Tests on money paths** — pricing, ledger, settlements (see testing.md).
3. **Error monitoring** — we must know about production errors before users tell us.
4. **Migrations in the deploy pipeline** — schema and code must never ship out of sync again.
5. **Server ownership + SSH keys** — production access under company control.

## Non-negotiables (the short list)

- Every change on its own branch; nothing commits to `develop`/`main` directly.
- Migrations ship **before or with** the code that needs them — never after.
- No failure is silent: every data read and mutation surfaces errors to the user.
- Money math changes require a test. No exceptions.
- Secrets never enter the repo — it is public. Templates use obvious placeholders.
- When a feature adds a variant (species, service type, payment rail), audit
  **every** downstream label, badge, and copy string for both variants.

## Amending these standards

Standards change by PR like code. If a rule is wrong, change the rule — don't
quietly break it. Each doc ends with a "Definition of done" checklist; PR
authors self-check against the relevant one.
