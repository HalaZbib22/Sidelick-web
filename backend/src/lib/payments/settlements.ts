import { query } from "../db.js";

/**
 * Cash-commission settlement — how the platform collects its cut of cash
 * bookings (the Careem/Uber cash model).
 *
 * Debt accrues in walker_ledger (positive cash_commission_due at capture,
 * negative payout_offset on refunds). Balance = SUM(amount) per currency.
 * A walker settles by minting a reference here, paying the platform's
 * Whish/OMT/BOB account out-of-band, and an admin confirming receipt — which
 * posts a negative 'adjustment' entry that closes the debt.
 *
 * When the online payout run is built, it should call getCashDebt() and net
 * the USD balance from the payout before transfer (then post the same
 * negative adjustment).
 */

export const SETTLEMENT_RAILS = ["whish", "omt", "bob"] as const;
export type SettlementRail = (typeof SETTLEMENT_RAILS)[number];

const SETTLEMENT_COLS = `
  id, walker_id AS "walkerId", amount, currency, method, reference, destination,
  status, admin_note AS "adminNote", created_at AS "createdAt", resolved_at AS "resolvedAt"
`;

type Result<T> =
  | ({ ok: true } & T)
  | { ok: false; code: "notfound" | "conflict" | "unprocessable"; message: string };

/** Outstanding cash-commission debt per currency (positive = walker owes). */
export async function getCashDebt(
  walkerId: string
): Promise<{ currency: string; amount: number }[]> {
  const r = await query<{ currency: string; amount: string }>(
    `SELECT currency, SUM(amount) AS amount
       FROM walker_ledger WHERE walker_id = $1
      GROUP BY currency HAVING SUM(amount) > 0
      ORDER BY SUM(amount) DESC`,
    [walkerId]
  );
  return r.rows.map((row) => ({ currency: row.currency, amount: Number(row.amount) }));
}

/** The debt threshold that blocks accepting new bookings (platform_config). */
export async function debtBlockThreshold(): Promise<number> {
  const r = await query<{ cash_debt_block_threshold: string }>(
    "SELECT cash_debt_block_threshold FROM platform_config WHERE id = 1"
  );
  return Number(r.rows[0]?.cash_debt_block_threshold ?? 50);
}

/**
 * Is this walker blocked from accepting new bookings?
 * v1 gates on the USD balance (the platform's default pricing currency).
 */
export async function isDebtBlocked(walkerId: string): Promise<boolean> {
  const [debt, threshold] = await Promise.all([getCashDebt(walkerId), debtBlockThreshold()]);
  const usd = debt.find((d) => d.currency === "USD")?.amount ?? 0;
  return usd >= threshold;
}

/** The walker's in-flight settlement, if any. */
export async function pendingSettlement(walkerId: string) {
  const r = await query(
    `SELECT ${SETTLEMENT_COLS} FROM commission_settlements
      WHERE walker_id = $1 AND status = 'pending'`,
    [walkerId]
  );
  return r.rows[0] ?? null;
}

function mintReference(rail: SettlementRail): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SETTLE-${rail.toUpperCase()}-${rand}`;
}

/** Open a settlement for the walker's full USD balance over the chosen rail. */
export async function createSettlement(
  walkerId: string,
  method: SettlementRail
): Promise<Result<{ settlement: Record<string, unknown> }>> {
  const debt = await getCashDebt(walkerId);
  const usd = debt.find((d) => d.currency === "USD");
  if (!usd || usd.amount <= 0) {
    return { ok: false, code: "unprocessable", message: "You have no outstanding balance — nothing to settle." };
  }

  const cfg = await query<{ whish_number: string; omt_beneficiary: string; bob_beneficiary: string }>(
    "SELECT whish_number, omt_beneficiary, bob_beneficiary FROM platform_config WHERE id = 1"
  );
  const c = cfg.rows[0];
  const destination =
    method === "whish" ? c?.whish_number : method === "omt" ? c?.omt_beneficiary : c?.bob_beneficiary;

  try {
    const r = await query(
      `INSERT INTO commission_settlements (walker_id, amount, currency, method, reference, destination)
       VALUES ($1, $2, 'USD', $3, $4, $5)
       RETURNING ${SETTLEMENT_COLS}`,
      [walkerId, usd.amount, method, mintReference(method), destination ?? null]
    );
    return { ok: true, settlement: r.rows[0] };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return { ok: false, code: "conflict", message: "You already have a settlement waiting for confirmation." };
    }
    throw e;
  }
}

/** Admin queue — pending first, walker context joined. */
export async function listSettlements(status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status && ["pending", "confirmed", "rejected"].includes(status)) {
    params.push(status);
    where = "WHERE cs.status = $1";
  }
  const r = await query(
    `SELECT cs.id, cs.walker_id AS "walkerId", cs.amount, cs.currency, cs.method,
            cs.reference, cs.destination, cs.status, cs.admin_note AS "adminNote",
            cs.created_at AS "createdAt", cs.resolved_at AS "resolvedAt",
            w.first_name || ' ' || left(w.last_name, 1) || '.' AS "walkerName"
       FROM commission_settlements cs
       JOIN users w ON w.id = cs.walker_id
       ${where}
       ORDER BY (cs.status = 'pending') DESC, cs.created_at DESC
       LIMIT 200`,
    params
  );
  return r.rows;
}

/**
 * Admin confirms money arrived: close the settlement and post the offsetting
 * ledger adjustment in one transaction-free but idempotent sequence (the
 * status guard prevents double-posting).
 */
export async function confirmSettlement(
  id: string
): Promise<Result<{ settlement: { id: string; walkerId: string; amount: number; currency: string } }>> {
  const r = await query<{ id: string; walkerId: string; amount: string; currency: string }>(
    `UPDATE commission_settlements
        SET status = 'confirmed', resolved_at = now()
      WHERE id = $1 AND status = 'pending'
      RETURNING id, walker_id AS "walkerId", amount, currency`,
    [id]
  );
  const s = r.rows[0];
  if (!s) {
    const exists = await query("SELECT status FROM commission_settlements WHERE id = $1", [id]);
    if (!exists.rows[0]) return { ok: false, code: "notfound", message: "Settlement not found" };
    return { ok: false, code: "conflict", message: "This settlement was already handled." };
  }
  await query(
    `INSERT INTO walker_ledger (walker_id, entry_type, amount, currency, note)
     VALUES ($1, 'adjustment', $2, $3, $4)`,
    [s.walkerId, -Number(s.amount), s.currency, `Settlement confirmed (${id})`]
  );
  return {
    ok: true,
    settlement: { id: s.id, walkerId: s.walkerId, amount: Number(s.amount), currency: s.currency },
  };
}

/** Admin rejects (money never arrived / wrong amount). Debt stays open. */
export async function rejectSettlement(
  id: string,
  adminNote?: string
): Promise<Result<{ settlement: { id: string; walkerId: string } }>> {
  const r = await query<{ id: string; walkerId: string }>(
    `UPDATE commission_settlements
        SET status = 'rejected', admin_note = $2, resolved_at = now()
      WHERE id = $1 AND status = 'pending'
      RETURNING id, walker_id AS "walkerId"`,
    [id, adminNote ?? null]
  );
  const s = r.rows[0];
  if (!s) {
    const exists = await query("SELECT status FROM commission_settlements WHERE id = $1", [id]);
    if (!exists.rows[0]) return { ok: false, code: "notfound", message: "Settlement not found" };
    return { ok: false, code: "conflict", message: "This settlement was already handled." };
  }
  return { ok: true, settlement: s };
}
