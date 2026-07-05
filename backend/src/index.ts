import "dotenv/config";
import { createServer } from "http";
import express from "express";
import "express-async-errors";
import cors from "cors";
import { timing, notFound, errorHandler } from "./middleware/error.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import { initRealtime } from "./lib/realtime.js";
import { startExpirySweeper } from "./lib/expiry.js";
import { checkMigrations } from "./lib/migrations.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
import { petsRouter } from "./routes/pets.js";
import { walkersRouter } from "./routes/walkers.js";
import { bookingsRouter } from "./routes/bookings.js";
import { reviewsRouter } from "./routes/reviews.js";
import { notificationsRouter } from "./routes/notifications.js";
import { pushRouter } from "./routes/push.js";
import { adminRouter } from "./routes/admin.js";
import { paymentsRouter } from "./routes/payments.js";
import { paymentsWebhookHandler } from "./routes/payments-webhook.js";

const app = express();

app.use(timing);
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(","),
  })
);
// Stripe webhook needs the raw body for signature verification, so it must be
// mounted BEFORE express.json() parses (and discards) the raw bytes.
app.post("/api/payments/webhook", ...paymentsWebhookHandler);

app.use(express.json());

// Routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
// Auth-gated (401 if no/invalid token)
app.use("/api/me", requireAuth, meRouter);
app.use("/api/pets", requireAuth, petsRouter);
app.use("/api/walkers", requireAuth, walkersRouter);
app.use("/api/bookings", requireAuth, bookingsRouter);
app.use("/api/reviews", requireAuth, reviewsRouter);
app.use("/api/notifications", requireAuth, notificationsRouter);
app.use("/api/push", requireAuth, pushRouter);
app.use("/api/payments", requireAuth, paymentsRouter);
// Admin-gated (401 then 403 for non-admins)
app.use("/api/admin", requireAuth, requireRole("admin"), adminRouter);

// Fallbacks
app.use(notFound);
app.use(errorHandler);

// HTTP server wraps Express so Socket.IO can share the same port.
const httpServer = createServer(app);

async function start() {
  // Refuse to boot on a stale schema (see lib/migrations.ts).
  await checkMigrations();

  initRealtime(httpServer);

  // Background job: expire booking requests walkers never answered.
  startExpirySweeper();

  const port = Number(process.env.PORT ?? 4000);
  httpServer.listen(port, () => {
    console.log(`Sidelick API listening on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("[startup] failed to start:", err);
  process.exit(1);
});

// smoke-test: verify Claude AI review runs
