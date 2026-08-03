# Frontend Standards (Next.js / React)

## Architecture

- **Single sources of truth, always:**
  - Routes & API endpoints → `lib/paths.ts` (never hardcode a URL in a component)
  - Types → `lib/types.ts`
  - Service catalog vocabulary (labels/icons/tones/units) → `lib/services.ts`
  - Amenity taxonomy → `lib/amenities.ts` (keep in sync with backend copy)
  - Brand mark → `components/brand/Logo.tsx` (never redraw it inline)
- All server state through **React Query** — no hand-rolled fetch-in-useEffect.
  Mutations invalidate the query keys they affect. Optimistic updates roll back
  on error (see `useFavorites` for the reference pattern).
- `apiFetch` is the only way to call the API: it sends credentials, unwraps the
  envelope, and throws typed `ApiError`s. Never raw `fetch` to our API.
- Auth state comes from `useAuth()`; the session hint in localStorage is
  display-only. The httpOnly cookie is the truth; never store tokens in JS.

## Errors are never silent

- Reads: the global `QueryCache` handler toasts failures — do not disable it.
  Sections with a designed error state (like the admin overview) may add one,
  in addition, not instead.
- Mutations: every `mutate()` call handles `onError` with a toast via
  `getApiErrorMessage`. Success paths toast when the user needs confirmation.
- Auth: only 401/403 signs a user out. A 5xx or network failure must never
  clear a session.

## Component discipline

- Pages compose; components do the work. When a page section grows past ~80
  lines of JSX or gets its own state, extract it to `components/<area>/`.
- Reusable UI goes in `components/ui/`; area components in `components/<area>/`.
- Skeletons for every loading list/card (they feel faster than spinners). The
  branded `LogoLoader` is reserved for brand moments only: auth gate, route
  transitions, payment confirmation.

## Forms

- Every input has a label AND a placeholder showing a realistic example value.
- Validate client-side for UX; the backend re-validates for truth.
- Submit buttons show a loading state and disable while pending.

## Definition of done

- [ ] No hardcoded endpoints/routes/labels that belong in a lib file
- [ ] Server state via React Query; affected keys invalidated
- [ ] Every mutation handles errors visibly
- [ ] Loading states designed (skeletons), empty states designed, error states designed
- [ ] Works on mobile width (the majority of users) and desktop
- [ ] Copy audited if the change touches a variant (species/service/rail)
