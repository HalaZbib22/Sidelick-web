#!/usr/bin/env node
/**
 * Dev seed — deterministic test accounts + data for smoke-testing.
 *
 * Creates (idempotently) the fixtures the Chrome smoke test can't make on its
 * own: an admin, a pending walker (flow 8 — verification), a verified walker
 * with availability and three reviews (flow 10 — rating average), and a
 * customer who authored those reviews.
 *
 * All accounts live under the @sidelick.test domain and share one password, so
 * the script is safe to re-run and easy to wipe. It ONLY ever touches rows tied
 * to @sidelick.test users — it never deletes real data.
 *
 *   Usage:  cd backend && npm run seed          # create / refresh
 *           cd backend && npm run seed -- --wipe  # remove all seed accounts
 *
 * Reads DATABASE_URL from backend/.env (via dotenv).
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = resolve(__dirname, "..");
const ASSETS_DIR = resolve(BACKEND_DIR, "seed_assets");
const UPLOAD_DIR = resolve(BACKEND_DIR, "private_uploads");

const SEED_DOMAIN = "@sidelick.test";
const PASSWORD = "Password123!";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error("ERROR: set DATABASE_URL (backend/.env) before seeding.");
  process.exit(1);
}

const wipe = process.argv.includes("--wipe");
const client = new pg.Client({ connectionString: DATABASE_URL });

/** Copy a seed asset into private_uploads under a stable name; return its ref. */
function stageVerificationFile(assetName, destName) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const src = resolve(ASSETS_DIR, assetName);
  const dest = resolve(UPLOAD_DIR, destName);
  if (existsSync(src)) copyFileSync(src, dest);
  return `private://verification/${destName}`;
}

/** Insert-or-update a user by email; returns the row id. */
async function upsertUser(u) {
  const passwordHash = u.password === null ? null : await bcrypt.hash(PASSWORD, 10);
  const res = await client.query(
    `INSERT INTO users (
        role, first_name, last_name, email, phone, password_hash,
        bio, latitude, longitude, home_address,
        service_types, subscription_tier,
        verification_status, verification_doc_type, verification_doc_url,
        verification_selfie_url, verification_provider, verification_submitted_at,
        max_pack_size, max_boarding_pets
     ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,$20
     )
     ON CONFLICT (email) DO UPDATE SET
        role = EXCLUDED.role,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        password_hash = EXCLUDED.password_hash,
        bio = EXCLUDED.bio,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        home_address = EXCLUDED.home_address,
        service_types = EXCLUDED.service_types,
        subscription_tier = EXCLUDED.subscription_tier,
        verification_status = EXCLUDED.verification_status,
        verification_doc_type = EXCLUDED.verification_doc_type,
        verification_doc_url = EXCLUDED.verification_doc_url,
        verification_selfie_url = EXCLUDED.verification_selfie_url,
        verification_provider = EXCLUDED.verification_provider,
        verification_submitted_at = EXCLUDED.verification_submitted_at,
        max_pack_size = EXCLUDED.max_pack_size,
        max_boarding_pets = EXCLUDED.max_boarding_pets,
        updated_at = now()
     RETURNING id`,
    [
      u.role, u.firstName, u.lastName, u.email, u.phone ?? null, passwordHash,
      u.bio ?? null, u.lat ?? null, u.lng ?? null, u.address ?? null,
      JSON.stringify(u.serviceTypes ?? []), u.tier ?? null,
      u.verificationStatus ?? "unverified", u.docType ?? null, u.docUrl ?? null,
      u.selfieUrl ?? null, "manual", u.submittedAt ?? null,
      u.maxPack ?? null, u.maxBoarding ?? null,
    ]
  );
  return res.rows[0].id;
}

async function seedAll() {
  console.log("Seeding Sidelick dev fixtures...\n");

  // Beirut-ish coordinates so walkers show on the map near the default view.
  const admin = await upsertUser({
    role: "admin", firstName: "Sidelick", lastName: "Admin",
    email: `admin${SEED_DOMAIN}`, phone: "+96170000001",
  });

  const pendingWalker = await upsertUser({
    role: "walker", firstName: "Pending", lastName: "Walker",
    email: `pending.walker${SEED_DOMAIN}`, phone: "+96170000002",
    bio: "Awaiting verification — submitted ID + selfie.",
    lat: 33.8938, lng: 35.5018, address: "Hamra, Beirut",
    serviceTypes: ["walk", "sit"], tier: "starter",
    verificationStatus: "pending", docType: "national_id",
    docUrl: stageVerificationFile("sample-id.png", "seed-pending-id.png"),
    selfieUrl: stageVerificationFile("sample-selfie.png", "seed-pending-selfie.png"),
    submittedAt: new Date().toISOString(),
    maxPack: 3, maxBoarding: 2,
  });

  const verifiedWalker = await upsertUser({
    role: "walker", firstName: "Verified", lastName: "Walker",
    email: `verified.walker${SEED_DOMAIN}`, phone: "+96170000003",
    bio: "Friendly, reliable dog walker in Beirut. Loves big dogs and long routes.",
    lat: 33.8959, lng: 35.4795, address: "Achrafieh, Beirut",
    serviceTypes: ["walk", "sit"], tier: "pro",
    verificationStatus: "verified", docType: "national_id",
    submittedAt: new Date(Date.now() - 7 * 864e5).toISOString(),
    maxPack: 4, maxBoarding: 3,
  });

  const customer = await upsertUser({
    role: "user", firstName: "Test", lastName: "Customer",
    email: `customer${SEED_DOMAIN}`, phone: "+96170000004",
    lat: 33.8886, lng: 35.4955, address: "Beirut",
  });

  // Weekly availability for the verified walker (Mon–Fri, 8:00–18:00).
  await client.query("DELETE FROM availability WHERE walker_id = $1", [verifiedWalker]);
  for (let weekday = 1; weekday <= 5; weekday++) {
    await client.query(
      "INSERT INTO availability (walker_id, weekday, start_time, end_time) VALUES ($1,$2,'08:00','18:00')",
      [verifiedWalker, weekday]
    );
  }

  // Three completed bookings (customer → verified walker) + their reviews, so
  // the walker shows ratingCount=3 / avg=4.67 on discovery and profile.
  // Clear any prior seed bookings between this pair first (cascades to reviews).
  await client.query(
    "DELETE FROM bookings WHERE customer_id = $1 AND walker_id = $2",
    [customer, verifiedWalker]
  );
  const ratings = [
    { rating: 5, comment: "Amazing with my dog — sent photos the whole walk." },
    { rating: 4, comment: "On time and friendly. Will book again." },
    { rating: 5, comment: "Best walker we've had. Highly recommend." },
  ];
  for (let i = 0; i < ratings.length; i++) {
    const start = new Date(Date.now() - (i + 2) * 864e5);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const booking = await client.query(
      `INSERT INTO bookings (customer_id, walker_id, service_type, status,
                             start_at, end_at, actual_start_at, actual_end_at,
                             currency, quoted_total)
       VALUES ($1,$2,'walk','completed',$3,$4,$3,$4,'USD',12)
       RETURNING id`,
      [customer, verifiedWalker, start.toISOString(), end.toISOString()]
    );
    await client.query(
      `INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5)`,
      [booking.rows[0].id, customer, verifiedWalker, ratings[i].rating, ratings[i].comment]
    );
  }

  console.log("Seeded accounts (password for all):", PASSWORD);
  console.table([
    { role: "admin", email: `admin${SEED_DOMAIN}` },
    { role: "walker (pending)", email: `pending.walker${SEED_DOMAIN}` },
    { role: "walker (verified)", email: `verified.walker${SEED_DOMAIN}` },
    { role: "customer", email: `customer${SEED_DOMAIN}` },
  ]);
  console.log("\nVerified walker: 3 reviews (5,4,5) → avg 4.67, Mon–Fri availability.");
}

async function wipeAll() {
  // bookings reference users ON DELETE RESTRICT, so clear any booking involving
  // a seed account first (reviews/segments cascade from bookings). Availability,
  // pets, push subs, etc. cascade directly from the user delete.
  await client.query(
    `DELETE FROM bookings WHERE customer_id IN (SELECT id FROM users WHERE email LIKE $1)
                              OR walker_id   IN (SELECT id FROM users WHERE email LIKE $1)`,
    [`%${SEED_DOMAIN}`]
  );
  const res = await client.query(
    "DELETE FROM users WHERE email LIKE $1 RETURNING email",
    [`%${SEED_DOMAIN}`]
  );
  console.log(`Wiped ${res.rowCount} seed account(s).`);
}

(async () => {
  await client.connect();
  try {
    if (wipe) await wipeAll();
    else await seedAll();
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
