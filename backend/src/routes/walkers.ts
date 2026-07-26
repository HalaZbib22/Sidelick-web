import { Router } from "express";
import { ok, notFoundError, unprocessable } from "../lib/response.js";
import { query } from "../lib/db.js";
import { isAmenityId } from "../lib/amenities.js";

// Mounted behind requireAuth. Owners discover VERIFIED walkers only.
export const walkersRouter = Router();

interface PricingCfg {
  base_walk_rate: number;
  base_sit_rate: number;
  base_daycare_rate: number | null;
  base_boarding_rate: number | null;
  base_drop_in_rate: number | null;
  tier_multipliers: Record<string, number>;
}

async function latestConfig(): Promise<PricingCfg | null> {
  const r = await query<PricingCfg>(
    `SELECT base_walk_rate, base_sit_rate, base_daycare_rate, base_boarding_rate,
            base_drop_in_rate, tier_multipliers
       FROM platform_pricing_config WHERE region = 'LB' ORDER BY version DESC LIMIT 1`
  );
  return r.rows[0] ?? null;
}

/** Rate + customer-facing unit per catalog service. */
function serviceRates(cfg: PricingCfg): { service: string; rate: number; unit: string }[] {
  return [
    { service: "walk", rate: Number(cfg.base_walk_rate), unit: "walk" },
    { service: "daycare", rate: Number(cfg.base_daycare_rate ?? cfg.base_sit_rate), unit: "day" },
    { service: "boarding", rate: Number(cfg.base_boarding_rate ?? cfg.base_sit_rate), unit: "night" },
    { service: "drop_in", rate: Number(cfg.base_drop_in_rate ?? cfg.base_sit_rate), unit: "visit" },
  ];
}

/** Cheapest rate among the services this walker offers, with its unit. */
function priceFrom(
  cfg: PricingCfg | null,
  serviceTypes: string[],
  tier: string | null
): { amount: number; unit: string } | null {
  if (!cfg) return null;
  const mult = (tier && cfg.tier_multipliers?.[tier]) || 1;
  const offered = serviceRates(cfg).filter(
    (r) => serviceTypes.includes(r.service) && r.rate > 0
  );
  if (offered.length === 0) return null;
  const cheapest = offered.reduce((a, b) => (b.rate < a.rate ? b : a));
  return { amount: Math.round(cheapest.rate * mult), unit: cheapest.unit };
}

// GET /api/walkers?service=walk|sit&walkShare=1&lat=..&lng=..&favorites=1&amenities=a,b,c&species=dog|cat
walkersRouter.get("/", async (req, res) => {
  const { service, walkShare, lat, lng, favorites, amenities, species } =
    req.query as Record<string, string>;
  const params: unknown[] = [];
  const where = ["u.role = 'walker'", "u.verification_status = 'verified'"];

  // Current viewer, for the isFavorite flag (and the favorites-only filter).
  params.push(req.user!.userId);
  const pViewer = params.length;
  if (favorites === "1") where.push("f.user_id IS NOT NULL");

  // Species filter — walker must care for the requested pet type.
  if (species === "dog" || species === "cat") {
    params.push(JSON.stringify([species]));
    where.push(`u.accepted_species @> $${params.length}::jsonb`);
  }

  // Amenity filter — AND semantics: walker must have every requested amenity.
  if (amenities) {
    const wanted = amenities.split(",").filter(isAmenityId);
    if (wanted.length > 0) {
      params.push(JSON.stringify(wanted));
      where.push(`u.amenities @> $${params.length}::jsonb`);
    }
  }

  if (["walk", "daycare", "boarding", "drop_in"].includes(service)) {
    params.push(JSON.stringify([service]));
    where.push(`u.service_types @> $${params.length}::jsonb`);
  }
  if (walkShare === "1") {
    params.push(JSON.stringify(["walk"]));
    where.push(`u.service_types @> $${params.length}::jsonb`);
  }

  const hasLoc = lat != null && lng != null && !isNaN(+lat) && !isNaN(+lng);
  let distanceSel = "NULL::float";
  if (hasLoc) {
    params.push(+lat);
    const pLat = params.length;
    params.push(+lng);
    const pLng = params.length;
    distanceSel = `(6371 * acos(LEAST(1, cos(radians($${pLat})) * cos(radians(u.latitude)) * cos(radians(u.longitude) - radians($${pLng})) + sin(radians($${pLat})) * sin(radians(u.latitude)))))`;
  }

  const sql = `
    SELECT u.id,
           u.first_name AS "firstName",
           left(u.last_name, 1) AS "lastInitial",
           u.service_types AS "serviceTypes",
           u.accepted_species AS "acceptedSpecies",
           u.subscription_tier AS "subscriptionTier",
           u.latitude, u.longitude,
           u.profile_photo_url AS "profilePhotoUrl",
           COALESCE(r.avg, 0)::float AS "ratingAvg",
           COALESCE(r.cnt, 0)::int  AS "ratingCount",
           (f.user_id IS NOT NULL)  AS "isFavorite",
           ${distanceSel} AS "distanceKm"
      FROM users u
      LEFT JOIN (SELECT reviewee_id, AVG(rating) avg, COUNT(*) cnt FROM reviews GROUP BY reviewee_id) r
        ON r.reviewee_id = u.id
      LEFT JOIN favorites f
        ON f.walker_id = u.id AND f.user_id = $${pViewer}
     WHERE ${where.join(" AND ")}
     ORDER BY "isFavorite" DESC, ${hasLoc ? `"distanceKm" NULLS LAST` : `"ratingAvg" DESC`}
     LIMIT 50`;

  const result = await query(sql, params);
  const cfg = await latestConfig();
  const walkers = result.rows.map((w: Record<string, unknown>) => {
    const pf = priceFrom(cfg, (w.serviceTypes as string[]) ?? [], (w.subscriptionTier as string) ?? null);
    return {
      ...w,
      distanceKm: w.distanceKm == null ? null : Math.round((w.distanceKm as number) * 10) / 10,
      priceFrom: pf?.amount ?? null,
      priceFromUnit: pf?.unit ?? null,
    };
  });
  return ok(res, { walkers });
});

// GET /api/walkers/:id — public profile of a verified walker.
walkersRouter.get("/:id", async (req, res) => {
  const result = await query(
    `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName",
            u.bio, u.service_types AS "serviceTypes", u.amenities,
            u.accepted_species AS "acceptedSpecies",
            u.subscription_tier AS "subscriptionTier",
            u.profile_photo_url AS "profilePhotoUrl",
            COALESCE(r.avg, 0)::float AS "ratingAvg", COALESCE(r.cnt, 0)::int AS "ratingCount",
            (f.user_id IS NOT NULL) AS "isFavorite"
       FROM users u
       LEFT JOIN (SELECT reviewee_id, AVG(rating) avg, COUNT(*) cnt FROM reviews GROUP BY reviewee_id) r
         ON r.reviewee_id = u.id
       LEFT JOIN favorites f
         ON f.walker_id = u.id AND f.user_id = $2
      WHERE u.id = $1 AND u.role = 'walker' AND u.verification_status = 'verified'`,
    [req.params.id, req.user!.userId]
  );
  const walker = result.rows[0];
  if (!walker) return notFoundError(res, "Walker not found");
  const cfg = await latestConfig();
  const pf = priceFrom(cfg, walker.serviceTypes ?? [], walker.subscriptionTier ?? null);
  walker.priceFrom = pf?.amount ?? null;
  walker.priceFromUnit = pf?.unit ?? null;
  return ok(res, { walker });
});

// PUT /api/walkers/:id/favorite — bookmark a walker. Idempotent.
walkersRouter.put("/:id/favorite", async (req, res) => {
  if (req.params.id === req.user!.userId) {
    return unprocessable(res, "You can't favorite yourself");
  }
  // Only verified walkers can be favorited (mirrors discovery visibility).
  const target = await query(
    `SELECT id FROM users
      WHERE id = $1 AND role = 'walker' AND verification_status = 'verified'`,
    [req.params.id]
  );
  if (!target.rows[0]) return notFoundError(res, "Walker not found");

  await query(
    `INSERT INTO favorites (user_id, walker_id) VALUES ($1, $2)
     ON CONFLICT (user_id, walker_id) DO NOTHING`,
    [req.user!.userId, req.params.id]
  );
  return ok(res, { walkerId: req.params.id, isFavorite: true }, "Walker saved");
});

// DELETE /api/walkers/:id/favorite — remove the bookmark. Idempotent.
walkersRouter.delete("/:id/favorite", async (req, res) => {
  await query(`DELETE FROM favorites WHERE user_id = $1 AND walker_id = $2`, [
    req.user!.userId,
    req.params.id,
  ]);
  return ok(res, { walkerId: req.params.id, isFavorite: false }, "Walker removed from saved");
});
