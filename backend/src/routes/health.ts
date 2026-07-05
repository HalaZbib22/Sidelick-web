import { Router } from "express";
import { ok, fail } from "../lib/response.js";
import { query } from "../lib/db.js";

export const healthRouter = Router();

// GET /api/health — connection + schema diagnostics.
// Open http://localhost:4000/api/health in a browser to see exactly which
// database the backend is connected to, and whether the schema is loaded.
healthRouter.get("/", async (_req, res) => {
  try {
    const r = await query<{
      database: string;
      dbuser: string;
      host: string | null;
      port: number | null;
      usersTable: boolean;
    }>(
      `SELECT current_database()                       AS database,
              current_user                             AS dbuser,
              inet_server_addr()::text                 AS host,
              inet_server_port()                       AS port,
              (to_regclass('public.users') IS NOT NULL) AS "usersTable"`
    );
    const info = r.rows[0];
    return ok(res, {
      status: "ok",
      db: "connected",
      database: info.database,
      dbUser: info.dbuser,
      host: info.host ?? "localhost (socket)",
      port: info.port,
      schemaLoaded: info.usersTable,
      hint: info.usersTable
        ? "Schema is present in this database — you're good to go."
        : `Connected to database "${info.database}", but the schema is NOT loaded here. ` +
          `Run db/migrations/0001_init.sql against THIS database (see BACKEND_GUIDE.md).`,
    });
  } catch (e) {
    return fail(
      res,
      "Database unreachable: " + (e instanceof Error ? e.message : "unknown error"),
      503
    );
  }
});
