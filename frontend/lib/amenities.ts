/**
 * Walker skills & amenities — the fixed taxonomy (single source of truth for the UI).
 * KEEP IN SYNC with backend/src/lib/amenities.ts (ids must match exactly).
 * Grouped for display; "care" skills render teal (trust) since they're
 * safety/competence signals, everything else renders neutral.
 */

export const AMENITY_GROUPS = [
  {
    id: "care",
    label: "Care skills",
    tone: "trust",
    items: [
      { id: "first-aid-cpr", label: "First aid / CPR" },
      { id: "oral-medication", label: "Oral medication" },
      { id: "injected-medication", label: "Injected medication" },
      { id: "senior-dog-experience", label: "Senior dog experience" },
      { id: "puppy-experience", label: "Puppy experience" },
      { id: "special-needs-experience", label: "Special-needs experience" },
    ],
  },
  {
    id: "home",
    label: "Home & environment",
    tone: "neutral",
    items: [
      { id: "lives-in-house", label: "Lives in a house" },
      { id: "lives-in-apartment", label: "Lives in an apartment" },
      { id: "fenced-garden", label: "Fenced garden" },
      { id: "swimming-pool", label: "Swimming pool" },
      { id: "non-smoking-home", label: "Non-smoking home" },
      { id: "home-during-week", label: "Home during the week" },
      { id: "has-children", label: "Has children at home" },
    ],
  },
  {
    id: "pets",
    label: "Their own pets",
    tone: "neutral",
    items: [
      { id: "has-dogs", label: "Has dogs" },
      { id: "has-cats", label: "Has cats" },
    ],
  },
  {
    id: "extras",
    label: "Service extras",
    tone: "neutral",
    items: [
      { id: "pet-pickup", label: "Can pick up pets" },
      { id: "daily-exercise", label: "Daily exercise" },
      { id: "potty-breaks", label: "Potty breaks" },
      { id: "accepts-long-stays", label: "Accepts long stays" },
    ],
  },
] as const;

export type AmenityId =
  (typeof AMENITY_GROUPS)[number]["items"][number]["id"];

/** Flat id list, e.g. for validation or "select all". */
export const ALL_AMENITY_IDS: AmenityId[] = AMENITY_GROUPS.flatMap((g) =>
  g.items.map((i) => i.id)
);

/** id → human label lookup. */
export const AMENITY_LABEL: Record<string, string> = Object.fromEntries(
  AMENITY_GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.label]))
);
