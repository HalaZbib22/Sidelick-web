import { query } from "./db.js";

/**
 * Pet reports — the walker-side mirror of disputes. A walker on a booking can
 * flag that a pet's profile misrepresented reality (undisclosed aggression,
 * hidden medical needs, a different pet than booked, ...). Admins review the
 * queue and mark reports reviewed (founded) or dismissed.
 */

export const PET_REPORT_CATEGORIES = [
  "profile_mismatch",
  "behavior_undisclosed",
  "health_undisclosed",
  "wrong_pet",
  "other",
] as const;
export type PetReportCategory = (typeof PET_REPORT_CATEGORIES)[number];
export type PetReportStatus = "open" | "reviewed" | "dismissed";

const VIEW_COLS = `
  pr.id, pr.booking_id AS "bookingId", pr.pet_id AS "petId",
  pr.category, pr.note, pr.status, pr.admin_note AS "adminNote",
  pr.created_at AS "createdAt", pr.resolved_at AS "resolvedAt"
`;

type Result<T> =
  | ({ ok: true } & T)
  | { ok: false; code: "notfound" | "forbidden" | "conflict"; message: string };

/** File a report. Caller must be the walker on an in_progress/completed booking. */
export async function filePetReport(input: {
  bookingId: string;
  petId: string;
  reporterId: string;
  category: PetReportCategory;
  note?: string;
}): Promise<Result<{ report: Record<string, unknown> }>> {
  const b = await query<{ walker_id: string; status: string }>(
    "SELECT walker_id, status FROM bookings WHERE id = $1",
    [input.bookingId]
  );
  const booking = b.rows[0];
  if (!booking) return { ok: false, code: "notfound", message: "Booking not found" };
  if (booking.walker_id !== input.reporterId) {
    return { ok: false, code: "forbidden", message: "Only the walker on this booking can file a report." };
  }
  if (!["in_progress", "completed"].includes(booking.status)) {
    return { ok: false, code: "conflict", message: "Reports can be filed once the service has started." };
  }
  const onBooking = await query(
    "SELECT 1 FROM booking_pets WHERE booking_id = $1 AND pet_id = $2",
    [input.bookingId, input.petId]
  );
  if (!onBooking.rows[0]) {
    return { ok: false, code: "notfound", message: "That pet isn't part of this booking." };
  }

  try {
    const r = await query(
      `INSERT INTO pet_reports (booking_id, pet_id, reporter_id, category, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, booking_id AS "bookingId", pet_id AS "petId", category, note,
                 status, admin_note AS "adminNote", created_at AS "createdAt",
                 resolved_at AS "resolvedAt"`,
      [input.bookingId, input.petId, input.reporterId, input.category, input.note ?? null]
    );
    return { ok: true, report: r.rows[0] };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return { ok: false, code: "conflict", message: "You already have an open report for this pet." };
    }
    throw e;
  }
}

/** The caller's reports on one booking (walker-side status display). */
export async function listReportsForBooking(bookingId: string, reporterId: string) {
  const r = await query(
    `SELECT ${VIEW_COLS} FROM pet_reports pr
      WHERE pr.booking_id = $1 AND pr.reporter_id = $2
      ORDER BY pr.created_at DESC`,
    [bookingId, reporterId]
  );
  return r.rows;
}

/** Admin queue — open first, joined with pet / walker / owner context. */
export async function listPetReports(status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status && ["open", "reviewed", "dismissed"].includes(status)) {
    params.push(status);
    where = "WHERE pr.status = $1";
  }
  const r = await query(
    `SELECT ${VIEW_COLS},
            p.name AS "petName", p.species AS "petSpecies", p.breed AS "petBreed",
            p.photo_url AS "petPhotoUrl",
            w.first_name || ' ' || left(w.last_name, 1) || '.' AS "walkerName",
            o.first_name || ' ' || left(o.last_name, 1) || '.' AS "ownerName"
       FROM pet_reports pr
       JOIN pets p     ON p.id = pr.pet_id
       JOIN users w    ON w.id = pr.reporter_id
       JOIN bookings b ON b.id = pr.booking_id
       JOIN users o    ON o.id = b.customer_id
       ${where}
       ORDER BY (pr.status = 'open') DESC, pr.created_at DESC
       LIMIT 200`,
    params
  );
  return r.rows;
}

/** Admin action: mark an open report reviewed (founded) or dismissed. */
export async function reviewPetReport(
  id: string,
  action: "reviewed" | "dismissed",
  adminNote?: string
): Promise<Result<{ report: { id: string; status: string; reporterId: string; petName: string } }>> {
  const r = await query<{ id: string; status: string; reporterId: string; petName: string }>(
    `UPDATE pet_reports pr
        SET status = $2, admin_note = $3, resolved_at = now()
       FROM pets p
      WHERE pr.id = $1 AND pr.status = 'open' AND p.id = pr.pet_id
      RETURNING pr.id, pr.status, pr.reporter_id AS "reporterId", p.name AS "petName"`,
    [id, action, adminNote ?? null]
  );
  if (!r.rows[0]) {
    const exists = await query("SELECT status FROM pet_reports WHERE id = $1", [id]);
    if (!exists.rows[0]) return { ok: false, code: "notfound", message: "Report not found" };
    return { ok: false, code: "conflict", message: "This report was already reviewed." };
  }
  return { ok: true, report: r.rows[0] };
}
