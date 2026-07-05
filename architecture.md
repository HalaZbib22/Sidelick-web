# Sidelick — Frontend Architecture

**Purpose:** How the frontend is wired — state, data fetching, code organization. Screens and flows live in `frontend_guide_v2.md`; business logic in `planning_v2.md`.

**Principle:** start simple, add complexity only when it pays for itself.

---

## State management

Match the tool to the *kind* of state:

| State | Tool | Examples |
|---|---|---|
| Auth / current user | **React Context** (`AuthContext`) | session, token, role |
| Server data | **React Query** (TanStack) | walkers, bookings, pets, messages |
| Local UI | **`useState`** | form inputs, modals, toggles |
| Complex global | **Redux** — only if it ever earns its keep | not needed at current scope |

Decision: auth → Context · from the API → React Query · component-only → `useState`. Don't reach further than that.

**Don't:** put server data in Context (no caching, extra re-renders), put form/UI state in Context, or read the token from `localStorage` directly in components — always go through `useAuth()`.

---

## Auth state (`AuthContext`)

Single source of truth for session/role, wrapped at the app root in `providers.tsx`. Exposes `session`, `isLoading`, `signIn(token)`, `signOut()`, `refreshSession()`. Syncs across tabs via the `storage` event. Components call `useAuth()` — never `getSession()`/`getToken()` directly.

> Security: tokens currently sit in `localStorage` (XSS-exposed). Before handling payments, evaluate httpOnly cookies + short-lived access tokens. Open decision.

---

## Server data (React Query)

Fetch through a thin `apiFetch` that unwraps the standard response envelope (`frontend_guide_v2.md` §8) and throws user-friendly errors. Wrap each resource in a hook — `usePets()`, `useBookings()`, `useWalkers()` — keyed by resource + relevant ids, gated on `enabled: !!session?.token`, with sane `staleTime`. This gives caching, dedup, and background refresh for free. Add optimistic updates only where the UX clearly benefits (e.g. sending a message).

Anything touching **money or availability** (price quotes, availability, booking creation) is **server-authoritative** — the client may estimate, but the server's value governs and is revalidated on submit.

---

## Authorization (RBAC)

Three roles: `user` (pet owner), `walker`, `admin`. Enforced on **both** ends — the backend is the security boundary; the frontend guard is UX only.

**Backend — the real enforcement.** Middleware + named response helpers keep status codes consistent:

| Situation | Status | Helper |
|---|---|---|
| No / invalid token | **401** | `requireAuth` → `unauthorized()` |
| Authenticated, wrong role | **403** | `requireRole(...)` → `forbidden()` |
| Resource doesn't exist *or* isn't yours | **404** | `notFoundError()` (privacy-preserving — don't reveal others' rows) |
| Duplicate / conflict | **409** | `conflict()` |
| Validation failed | **422** (or 400) | `unprocessable(msg, fieldErrors)` |

Pattern: gate role-restricted route groups at mount (`app.use("/api/admin", requireAuth, requireRole("admin"), adminRouter)`); inside handlers, check row ownership with `isOwnerOrAdmin(req, ownerId)` and return **404** (not 403) when it fails, so you don't leak that another user's resource exists. Admins bypass ownership.

**Frontend — UX guard only.** `useRequireAuth(roles?)` / `<Protected roles={[...]}>` redirect: not signed in → `/signin`; wrong role → `/unauthorized`. This runs **client-side** because the JWT lives in `localStorage` and isn't visible to Next.js edge middleware. If/when we move to httpOnly cookies, real edge middleware becomes possible — another reason that migration is on the list.

Never rely on the client guard for security — a user can call the API directly; the backend must always re-check.

## Code organization

- **Centralized paths:** all routes and API endpoints come from `lib/paths.ts` (`routes.*`, `api.*`, builders like `buildSignupPath`). Never hardcode a path or endpoint string.
- **Validation:** reusable/complex validators in `lib/validation.ts`; inline only for trivial one-offs. Frontend validation is UX; the backend is the security boundary, and rules must match the schema in `planning_v2.md`.
- **Structure:** `components/`, `lib/`, `hooks/`, `contexts/`, `types/`. Group imports external → internal → utils → types.
- **TypeScript everywhere:** type props, API responses, and hook returns.
- **DRY + single responsibility:** extract shared logic; keep functions focused. Comment the *why*, not the *what*.

---

## Build order (where state plumbing fits)

1. `AuthContext` + `useAuth()`; replace any direct `localStorage` reads.
2. React Query + resource hooks as data screens come online.
3. Optimistic updates only where they matter.
4. Redux only if global state genuinely becomes multi-slice and complex — not before.
