# Sidelick — Backend Guide

Everything about the API: what it is, how to run it, how to confirm it's connected, every endpoint, and how to fix the common problems.

---

## What the backend is

A small **API server** (Express + TypeScript) that talks to your **PostgreSQL** database. The website (`frontend/`) never touches the database directly — it calls this API, which validates requests, enforces permissions, and reads/writes the database.

- Runs on **http://localhost:4000**
- All endpoints live under **`/api/...`**
- Every response uses the same shape (the "envelope"): `{ succeeded, statusCode, data, message, elapsedMilliseconds }`

> Opening `http://localhost:4000/` in a browser correctly shows `Not found: GET /` — there's no page at the root. The API is under `/api/...`. The *website* is at `http://localhost:3000`.

---

## Run it

From the `backend` folder:

```bash
cd "/Users/halazbib/Documents/Claude/Projects/Sidelick/backend"
cp .env.example .env     # first time only, then edit it (see below)
npm install              # first time, or after I add a package
npm run dev              # starts the server with auto-reload
```

You should see: `Sidelick API listening on http://localhost:4000`.

To stop it: click the terminal, press **Ctrl+C**. To start again: `npm run dev`.

---

## The `.env` file (what each line means)

```
PORT=4000                                                  # port the API runs on
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/DBNAME # how it reaches Postgres
JWT_SECRET=<a long random string>                          # signs login tokens
JWT_EXPIRES_IN=7d                                          # how long a login lasts
CORS_ORIGIN=http://localhost:3000                          # which site may call the API
FRONTEND_URL=http://localhost:3000                         # used for password-reset links
NODE_ENV=development
```

The `DATABASE_URL` is the piece that matters most. Format:

```
postgres://[user]:[password]@[host]:[port]/[database name]
```

For your setup that's: `postgres://sidelick:YOUR_PASSWORD@localhost:5432/sidelick`
(user `sidelick`, the password you set, and the **database** named `sidelick`).

Generate `JWT_SECRET` with: `openssl rand -hex 32`

---

## Confirm it's connected (your new best friend)

Open **http://localhost:4000/api/health** in a browser. You'll get something like:

```json
{
  "succeeded": true,
  "data": {
    "status": "ok",
    "db": "connected",
    "database": "sidelick",
    "dbUser": "sidelick",
    "port": 5432,
    "schemaLoaded": true,
    "hint": "Schema is present in this database — you're good to go."
  }
}
```

Read it like this:

- **`database`** — the exact database the backend is using right now. Tables must exist *in this one*.
- **`port`** — which PostgreSQL it reached. Compare to the port your pgAdmin server uses (see Troubleshooting).
- **`schemaLoaded`** — `true` means the `users` table exists here. **`false` means you created the tables in a different database** than the backend is using.

This endpoint is the fastest way to diagnose any "database" problem.

---

## Loading the database schema (the reliable way)

The whole schema is one file: `db/migrations/0001_init.sql`. Load it into the **same database** the health check reports.

Using pgAdmin (most reliable):

1. Left tree → expand **Servers → (your server) → Databases**, and **single-click the `sidelick` database** to select it.
2. **Tools → Query Tool**.
3. Run `SELECT current_database();` — it must say **`sidelick`** (the same name `/api/health` reports). If not, reopen the Query Tool after selecting the right database.
4. Open `db/migrations/0001_init.sql` (folder icon) or paste its full contents, then **Run** (F5).
5. Verify: `SELECT to_regclass('public.users');` → returns `users`.

Now refresh `/api/health` — `schemaLoaded` should be `true`. Create an account on the website and it works.

---

## Endpoint reference

Public:
- `POST /api/auth/signup` — create account `{ firstName, lastName, email, password, role }`
- `POST /api/auth/signin` — `{ email, password }` → returns a token
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- `GET /api/health` — diagnostics (above)

Requires a login token (`Authorization: Bearer <token>`):
- `GET /api/me` — your profile
- `GET/POST /api/pets`, `GET/PATCH/DELETE /api/pets/:id` — your pets

Admin only (403 otherwise):
- `GET /api/admin/users`, `PATCH /api/admin/users/:id/verify`

### Testing endpoints by hand

Health (browser is fine): visit `http://localhost:4000/api/health`.

Signup with curl (Terminal):

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Hala","lastName":"Z","email":"hala@example.com","password":"password123","role":"user"}'
```

A success returns `"succeeded": true` with a token. Re-running it returns `409 Email already in use` — which means it's working.

---

## Troubleshooting

| What you see | What it means | Fix |
|---|---|---|
| `relation "users" does not exist` | Backend is connected, but the schema isn't in *that* database. | Open `/api/health`, read `database`, load `0001_init.sql` into that exact database. |
| `/api/health` `schemaLoaded: false` | Same as above — wrong database has the tables. | Load the schema into the database `/api/health` names. |
| `database "sidelick" does not exist` | The database itself isn't there. | Create it in pgAdmin (Databases → Create → Database → `sidelick`). |
| `password authentication failed` | Wrong user/password in `DATABASE_URL`. | Fix `backend/.env`; reset the role password in pgAdmin if unsure. |
| `/api/health` shows a `port` different from your pgAdmin server's port | You have **two** PostgreSQL installs; backend and pgAdmin are talking to different ones. | Point `DATABASE_URL` to the port pgAdmin uses, **or** load the schema into the cluster on the backend's port. Check pgAdmin port via Servers → (server) → Properties → Connection → Port. |
| `Not found: GET /` in the browser | You opened the API root — normal. | Use `/api/health`, or the website at `:3000`. |
| Server prints an error but keeps running | Good — errors now return a clean 500 instead of crashing. | Read the `message`. |

---

## The two-PostgreSQL trap (most likely cause of your current issue)

If you installed PostgreSQL more than once (e.g. the EDB installer *and* Postgres.app, or via Homebrew), you have two separate database servers, often on ports 5432 and 5433. pgAdmin might be showing one while the backend connects to the other — so tables you create in pgAdmin are invisible to the backend.

How to tell: compare the **`port`** from `/api/health` with the port of your pgAdmin server (Servers → your server → right-click → Properties → Connection → Port). If they differ, that's the whole problem. Either change `DATABASE_URL` to use pgAdmin's port, or run the schema against the server on the backend's port.
