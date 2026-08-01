/**
 * Walker skills & amenities — valid ids for validation and filtering.
 * KEEP IN SYNC with frontend/lib/amenities.ts (the display taxonomy).
 */
export const AMENITY_IDS = [
  // care skills
  "first-aid-cpr",
  "oral-medication",
  "injected-medication",
  "senior-dog-experience",
  "puppy-experience",
  "special-needs-experience",
  // home & environment
  "lives-in-house",
  "lives-in-apartment",
  "fenced-garden",
  "swimming-pool",
  "non-smoking-home",
  "home-during-week",
  "has-children",
  // their own pets
  "has-dogs",
  "has-cats",
  // service extras
  "pet-pickup",
  "daily-exercise",
  "potty-breaks",
  "accepts-long-stays",
] as const;

export type AmenityId = (typeof AMENITY_IDS)[number];

export function isAmenityId(v: string): v is AmenityId {
  return (AMENITY_IDS as readonly string[]).includes(v);
}
