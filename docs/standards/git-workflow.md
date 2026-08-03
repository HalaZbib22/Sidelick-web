# Git & Release Workflow

## Branches

- `main` — production. **The only branch that deploys.** Never commit to it directly.
- `develop` — integration (default branch). Feature PRs merge here first.
- Work branches — one per change, however small: `feat/...`, `fix/...`, `chore/...`.
  A one-line fix still gets its own branch. Never batch unrelated changes.

## The flow

1. `git checkout develop && git pull`
2. `git checkout -b feat/short-descriptive-name`
3. Commit with a conventional message: `feat(scope): what and why`
   (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`)
4. Push, open a PR into `develop`, merge after CI is green.
5. To release: PR `develop` → `main`. The deploy runs from `main` only.

## Releases must be whole

A release (develop → main) ships everything pending, in order:
migrations first (see devops.md), then the merge. Never cherry-pick individual
commits to `main` — that is how frontend and backend versions drift apart.

## Commit hygiene

- Messages describe the *why*, not just the *what*, when the why isn't obvious.
- No secrets, tokens, or real credentials in any commit — the repo is public.
- Delete merged branches; a stale branch list hides the active work.
- macOS/iCloud can create `" 2"` duplicate files — check `git status` before
  `git add -A` and never commit them.

## Definition of done

- [ ] Change lives on its own `feat/`/`fix/`/`chore/` branch
- [ ] PR targets `develop` (only release PRs target `main`)
- [ ] Commit messages are conventional and explain intent
- [ ] No unrelated files swept into the commit
