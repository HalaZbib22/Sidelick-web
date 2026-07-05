import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { query } from "./db.js";

/**
 * Boot-time guard against running the API on an out-of-date schema.
 *
 * The `db/migrate.mjs` runner records every applied file in `_migrations`. Here
 * we compare that against the `.sql` files on disk and refuse to start if any
 * are unapplied — the failure surfaces loudly at boot instead of as a 500 the
 * first time a request touches the missing column/table (which is exactly how
 * the `respond_by` bug slipped through).
 *
 * Override with ALLOW_PENDING_MIGRATIONS=1 for the rare case you knowingly want
 * to boot against a partial schema (e.g. debugging a failed migration).
 */
export async function checkMigrations(): Promise<void> {
  // Migrations live at db/migrations; the API is started from backend/, so the
  // sibling path is ../db/migrations relative to the working directory.
  const dir = resolve(process.cwd(), "../db/migrations");

  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    console.warn(`[migrations] could not read ${dir} — skipping migration check.`);
    return;
  }

  let applied: Set<string>;
  try {
    const res = await query<{ name: string }>("SELECT name FROM _migrations");
    applied = new Set(res.rows.map((r) => r.name));
  } catch {
    // No _migrations table at all → the database has never been migrated.
    applied = new Set();
  }

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) return;

  const msg =
    `\n[migrations] ${pending.length} unapplied migration(s):\n` +
    pending.map((f) => `  - ${f}`).join("\n") +
    `\n\nRun them first:  cd db && DATABASE_URL=... npm run migrate\n` +
    `(Set ALLOW_PENDING_MIGRATIONS=1 to boot anyway.)\n`;

  if (process.env.ALLOW_PENDING_MIGRATIONS === "1") {
    console.warn(msg + "\nALLOW_PENDING_MIGRATIONS=1 set — starting anyway.\n");
    return;
  }

  console.error(msg);
  process.exit(1);
}
