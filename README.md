# Sidelick

**A dog walking & sitting platform connecting pet owners with verified local walkers.** Built web/PWA-first for Beirut, designed to scale into the Gulf.

Sidelick lets pet owners find trusted, ID-verified walkers nearby, book a walk or sitting in a few taps, follow along in real time with check-in photos, and pay securely — while walkers get a lightweight way to run their business, manage availability, and build a reputation through reviews.

> **Tech:** Next.js 14 (App Router) PWA · Express + TypeScript · PostgreSQL · Socket.IO · Web Push

---

## Features

- **Accounts & roles** — pet owners and walkers, with JWT auth and role-based access.
- **Walker onboarding & ID verification** — walkers complete a full profile but can't transact until an admin verifies their government ID and selfie, keeping the marketplace trustworthy.
- **Pet profiles** — owners add pets with breed, size, and temperament so walkers know what they're taking on.
- **Discovery** — browse and filter available walkers by service and availability.
- **Transparent pricing** — a server-side pricing engine quotes each booking before the owner commits.
- **Stepped booking + state machine** — request → accept/decline → start → complete, with automatic expiry when a walker doesn't respond in time.
- **Recurring bookings** — schedule a repeating series in one flow.
- **Live walk tracking** — walkers check in with start / mid / end photos owners can see in real time.
- **Real-time notifications** — Socket.IO in-app bell plus Web Push for closed-app alerts, with a per-category notification center (booking updates, reviews, reminders) owners control.
- **Reviews & ratings** — owners rate completed walks; walkers build a public reputation.
- **Admin panel** — verify walkers, review submitted documents, and manage users.
- **Installable PWA** — add to home screen, works like a native app.

---

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS, React Query, Sonner |
| Backend | Node.js, Express, TypeScript (ESM), Zod validation |
| Database | PostgreSQL (append-only SQL migrations) |
| Real-time | Socket.IO + Web Push (VAPID) |
| Auth | JWT |

---

## Project structure

```
Sidelick/
├── *.md                 planning & design docs (roadmap.md, planning_v2.md, architecture.md, api_endpoints.md)
├── schema.sql           canonical PostgreSQL schema
├── db/                  migrations + runner
├── backend/             API — Express + TypeScript + pg + Socket.IO
│   └── src/routes/      auth · me · pets · walkers · bookings · reviews · notifications · push · admin · health
└── frontend/            web/PWA — Next.js App Router + Tailwind
    └── app/             signup · onboarding · dashboard · pets · walkers · bookings · profile · settings · admin
```

---

## Getting started

**Prerequisites:** Node 20+, PostgreSQL 14+.

> New to running a project locally? Follow **[SETUP.md](./SETUP.md)** — a step-by-step, no-experience-needed guide for macOS. The short version is below.

**1. Database**
```bash
createdb sidelick
cd db && npm install
DATABASE_URL=postgres://USER:PASS@localhost:5432/sidelick npm run migrate
```

**2. Backend** (new terminal)
```bash
cd backend
cp .env.example .env        # fill DATABASE_URL + JWT_SECRET (openssl rand -hex 32)
npm install
npm run dev                 # http://localhost:4000
```
Health check: `curl http://localhost:4000/api/health`

**3. Frontend** (new terminal)
```bash
cd frontend
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                 # http://localhost:3000
```

Open <http://localhost:3000>, create an account, add a pet, and walk through the booking flow. To seed sample walkers and data, run `npm run seed` in `backend/`.

---

## Status & roadmap

The core marketplace loop is built: accounts, walker verification, pets, discovery, pricing, the full booking state machine, walk tracking with photos, reviews, and real-time notifications. Payment integration (Stripe) is the next major milestone. See **[roadmap.md](./roadmap.md)** for the full build order and **[api_endpoints.md](./api_endpoints.md)** for the API surface.

---

## Notes

- **Security:** JWTs are currently stored in `localStorage`; migrating to httpOnly cookies is planned before payments go live (see `architecture.md`).
- **PWA icons:** drop `icon-192.png` / `icon-512.png` into `frontend/public/icons/`.
- **Web Push** is a no-op until VAPID keys are configured in `backend/.env`.

---

_Sidelick is an independent product, evolved from an earlier React Native bootcamp project into a production-oriented web platform._
