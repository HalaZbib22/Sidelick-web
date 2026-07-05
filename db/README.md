# Sidelick — Database

PostgreSQL schema and migrations. Canonical schema lives in `../schema.sql`; the first migration (`migrations/0001_init.sql`) is a copy of it.

## Rules

- **Never edit an applied migration.** Add a new `NNNN_description.sql` file (zero-padded, in order).
- This matches the versioned `platform_pricing_config` philosophy: changes are append-only and auditable.

## Run

```bash
# 1. create an empty database
createdb sidelick

# 2. install + apply migrations
npm install
DATABASE_URL=postgres://USER:PASS@localhost:5432/sidelick npm run migrate
```

The runner records applied files in a `_migrations` table and is safe to re-run (it skips what's already applied).

## Next migration template

```
migrations/
  0001_init.sql          # full schema
  0002_<change>.sql       # e.g. add community tables
```
