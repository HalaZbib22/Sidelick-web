import { Router } from "express";
import { ok, notFoundError } from "../lib/response.js";
import { query } from "../lib/db.js";

// Mounted behind requireAuth. Owners discover VERIFIED walkers only.
export const walkersRouter = Router();

interface PricingCfg {
  base_walk_rate: number;
  base_sit_rate: number;
  tier_multipliers: Record<string, number>;
}

async function latestConfig(): Promise<PricingCfg | null> {
  const r = await query<PricingCfg>(
    `SELECT base_walk_rate, base_sit_rate, tier_multipliers
       FROM platform_pricing_config WHERE region = 'LB' ORDER BY version DESC LIMIT 1`
  );
  return r.rows[0] ?? null;
}

function priceFrom(cfg: PricingCfg | null, serviceTypes: string[], tier: string | null): number | null {
  if (!cfg) return null;
  const mult = (tier && cfg.tier_multipliers?.[tier]) || 1;
  const offersWalk = serviceTypes.includes("walk");
  const base = offersWalk ? Number(cfg.base_walk_rate) : Number(cfg.base_sit_rate);
  if (!base) return null;
  return Math.round(base * mult);
}

// GET /api/walkers?service=walk|sit&walkShare=1&lat=..&lng=..
walkersRouter.get("/", async (req, res) => {
  const { service, walkShare, lat, lng } = req.query as Record<string, string>;
  const params: unknown[] = [];
  const where = ["u.role = 'walker'", "u.verification_status = 'verified'"];

  if (service === "walk" || service === "sit") {
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
           u.subscription_tier AS "subscriptionTier",
           u.latitude, u.longitude,
           u.profile_photo_url AS "profilePhotoUrl",
           COALESCE(r.avg, 0)::float AS "ratingAvg",
           COALESCE(r.cnt, 0)::int  AS "ratingCount",
           ${distanceSel} AS "distanceKm"
      FROM users u
      LEFT JOIN (SELECT reviewee_id, AVG(rating) avg, COUNT(*) cnt FROM reviews GROUP BY reviewee_id) r
        ON r.reviewee_id = u.id
     WHERE ${where.join(" AND ")}
     ORDER BY ${hasLoc ? `"distanceKm" NULLS LAST` : `"ratingAvg" DESC`}
     LIMIT 50`;

  const result = await query(sql, params);
  const cfg = await latestConfig();
  const walkers = result.rows.map((w: Record<string, unknown>) => ({
    ...w,
    distanceKm: w.distanceKm == null ? null : Math.round((w.distanceKm as number) * 10) / 10,
    priceFrom: priceFrom(cfg, (w.serviceTypes as string[]) ?? [], (w.subscriptionTier as string) ?? null),
  }));
  return ok(res, { walkers });
});

// GET /api/walkers/:id — public profile of a verified walker.
walkersRouter.get("/:id", async (req, res) => {
  const result = await query(
    `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName",
            u.bio, u.service_types AS "serviceTypes", u.subscription_tier AS "subscriptionTier",
            u.profile_photo_url AS "profilePhotoUrl",
            COALESCE(r.avg, 0)::float AS "ratingAvg", COALESCE(r.cnt, 0)::int AS "ratingCount"
       FROM users u
       LEFT JOIN (SELECT reviewee_id, AVG(rating) avg, COUNT(*) cnt FROM reviews GROUP BY reviewee_id) r
         ON r.reviewee_id = u.id
      WHERE u.id = $1 AND u.role = 'walker' AND u.verification_status = 'verified'`,
    [req.params.id]
  );
  const walker = result.rows[0];
  if (!walker) return notFoundError(res, "Walker not found");
  const cfg = await latestConfig();
  walker.priceFrom = priceFrom(cfg, walker.serviceTypes ?? [], walker.subscriptionTier ?? null);
  return ok(res, { walker });
});
