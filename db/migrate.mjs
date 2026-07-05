#!/usr/bin/env node
/**
 * Dependency-light migration runner.
 * Applies db/migrations/*.sql in filename order, once each, inside a transaction,
 * tracking applied files in a _migrations table.
 *
 * Usage:  DATABASE_URL=postgres://user:pass@host:5432/sidelick node migrate.mjs
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error("ERROR: set DATABASE_URL (e.g. postgres://user:pass@localhost:5432/sidelick)");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const applied = new Set(
    (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name)
  );

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    process.stdout.write(`Applying ${file} ... `);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log("done");
      ran++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("FAILED\n", err.message);
      process.exit(1);
    }
  }

  console.log(ran ? `\n${ran} migration(s) applied.` : "\nNothing to apply — up to date.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.end());
