import { Router } from "express";
import { z } from "zod";
import { ok, notFoundError, unprocessable } from "../lib/response.js";
import { isOwnerOrAdmin } from "../middleware/auth.js";
import { query } from "../lib/db.js";

// Mounted behind requireAuth — req.user is always present.
export const petsRouter = Router();

// Columns aliased to camelCase so the API speaks the frontend's language.
const SELECT_COLS = `
  id, name, breed,
  age_years        AS "ageYears",
  size,
  weight_kg        AS "weightKg",
  friendly_with_pets AS "friendlyWithPets",
  notes,
  photo_url        AS "photoUrl",
  created_at       AS "createdAt"
`;

const petSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  breed: z.string().trim().max(50).optional().nullable(),
  ageYears: z.coerce.number().int().min(0).max(30).optional().nullable(),
  size: z.enum(["small", "medium", "large"]).optional().nullable(),
  weightKg: z.coerce.number().positive().max(200).optional().nullable(),
  friendlyWithPets: z.enum(["friendly", "selective", "not_friendly"]),
  notes: z.string().trim().max(1000).optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
});
const petUpdateSchema = petSchema.partial();

/** Fetch a pet only if the caller may see it; else null (→ 404). */
async function getOwnedPet(petId: string, req: import("express").Request) {
  const result = await query<{ owner_id: string }>(
    "SELECT owner_id FROM pets WHERE id = $1",
    [petId]
  );
  const row = result.rows[0];
  if (!row || !isOwnerOrAdmin(req, row.owner_id)) return null;
  return row;
}

// GET /api/pets — caller's pets.
petsRouter.get("/", async (req, res) => {
  const result = await query(
    `SELECT ${SELECT_COLS} FROM pets WHERE owner_id = $1 ORDER BY created_at DESC`,
    [req.user!.userId]
  );
  return ok(res, { pets: result.rows });
});

// POST /api/pets
petsRouter.post("/", async (req, res) => {
  const parsed = petSchema.safeParse(req.body);
  if (!parsed.success) {
    return unprocessable(res, "Please check the form and try again.", parsed.error.flatten());
  }
  const p = parsed.data;
  const result = await query(
    `INSERT INTO pets (owner_id, name, breed, age_years, size, weight_kg, friendly_with_pets, notes, photo_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${SELECT_COLS}`,
    [
      req.user!.userId,
      p.name,
      p.breed ?? null,
      p.ageYears ?? null,
      p.size ?? null,
      p.weightKg ?? null,
      p.friendlyWithPets,
      p.notes ?? null,
      p.photoUrl ?? null,
    ]
  );
  return ok(res, { pet: result.rows[0] }, "Pet added", 201);
});

// GET /api/pets/:id
petsRouter.get("/:id", async (req, res) => {
  if (!(await getOwnedPet(req.params.id, req))) return notFoundError(res, "Pet not found");
  const result = await query(`SELECT ${SELECT_COLS} FROM pets WHERE id = $1`, [req.params.id]);
  return ok(res, { pet: result.rows[0] });
});

// PATCH /api/pets/:id
petsRouter.patch("/:id", async (req, res) => {
  if (!(await getOwnedPet(req.params.id, req))) return notFoundError(res, "Pet not found");

  const parsed = petUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return unprocessable(res, "Please check the form and try again.", parsed.error.flatten());
  }

  // Build a dynamic SET clause from provided fields only.
  const map: Record<string, string> = {
    name: "name",
    breed: "breed",
    ageYears: "age_years",
    size: "size",
    weightKg: "weight_kg",
    friendlyWithPets: "friendly_with_pets",
    notes: "notes",
    photoUrl: "photo_url",
  };
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of Object.entries(map)) {
    if (key in parsed.data) {
      values.push((parsed.data as Record<string, unknown>)[key] ?? null);
      sets.push(`${col} = $${values.length}`);
    }
  }
  if (!sets.length) {
    const current = await query(`SELECT ${SELECT_COLS} FROM pets WHERE id = $1`, [req.params.id]);
    return ok(res, { pet: current.rows[0] }, "No changes");
  }
  values.push(req.params.id);
  const result = await query(
    `UPDATE pets SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING ${SELECT_COLS}`,
    values
  );
  return ok(res, { pet: result.rows[0] }, "Pet updated");
});

// DELETE /api/pets/:id
petsRouter.delete("/:id", async (req, res) => {
  if (!(await getOwnedPet(req.params.id, req))) return notFoundError(res, "Pet not found");
  try {
    await query("DELETE FROM pets WHERE id = $1", [req.params.id]);
    return ok(res, { id: req.params.id }, "Pet removed");
  } catch {
    // FK RESTRICT: pet is referenced by a booking.
    return unprocessable(res, "This pet has bookings and can't be deleted yet.");
  }
});
