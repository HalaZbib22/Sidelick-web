# Contributing to Sidelick

## Branch model

We run a two-tier flow:

- **`develop`** — staging. Everything integrates here first and gets tested.
- **`main`** — production / live. Only promoted from `develop` once staging looks good.

You never commit directly to `develop` or `main`. You branch off `develop`, open a PR back into `develop`, and later promote `develop` → `main` with a PR.

## Day-to-day workflow

1. Start from an up-to-date `develop`:

   ```bash
   git checkout develop
   git pull
   ```

2. Cut a feature branch. Use a `type/short-description` name:

   ```bash
   git checkout -b feat/walker-availability
   ```

   Common prefixes: `feat/`, `fix/`, `chore/`, `refactor/`, `docs/`.

3. Do the work, commit, and push:

   ```bash
   git add .
   git commit -m "feat: add walker availability calendar"
   git push -u origin feat/walker-availability
   ```

4. Open a PR into **`develop`**. This triggers:
   - **CI** — backend and frontend typecheck + build must pass.
   - **Claude AI review** — inline comments on the diff.

5. Once CI is green and you've addressed review comments, merge into `develop` and test on staging.

## Promoting to production

When `develop` is stable and tested, open a PR from `develop` into **`main`**. The same CI + AI review gates run. Merge to ship to production.

## Interactive AI help

Mention `@claude` in any issue or PR comment to have it investigate, answer, or push changes to the branch.

## Commit messages

Use a short imperative summary, optionally prefixed with the type (`feat:`, `fix:`, `chore:`). Keep the first line under ~72 characters.
