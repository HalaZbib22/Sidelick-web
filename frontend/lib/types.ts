export type Role = "user" | "walker" | "admin";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type ServiceType = "walk" | "daycare" | "boarding" | "drop_in";
export type DocType = "national_id" | "drivers_license" | "passport";

export type NotificationType =
  | "booking_requested"
  | "booking_accepted"
  | "booking_declined"
  | "booking_cancelled"
  | "booking_expired"
  | "walk_started"
  | "walk_completed"
  | "review_received"
  | "payment_received"
  | "dispute_opened"
  | "dispute_resolved"
  | "promo";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  bookingId: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface Me {
  id: string;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  bio: string | null;
  serviceTypes: ServiceType[];
  amenities: string[];
  acceptedSpecies: PetSpecies[];
  maxPackSize: number | null;
  maxBoardingPets: number | null;
  verificationStatus: VerificationStatus;
}

export interface WalkerCard {
  id: string;
  firstName: string;
  lastInitial: string;
  serviceTypes: ServiceType[];
  acceptedSpecies: PetSpecies[];
  subscriptionTier: string | null;
  latitude: number | null;
  longitude: number | null;
  profilePhotoUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  distanceKm: number | null;
  priceFrom: number | null;
  priceFromUnit: string | null;
  isFavorite: boolean;
}

export interface WalkerProfile {
  id: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  serviceTypes: ServiceType[];
  amenities: string[];
  acceptedSpecies: PetSpecies[];
  subscriptionTier: string | null;
  profilePhotoUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  priceFrom: number | null;
  priceFromUnit: string | null;
  isFavorite: boolean;
}

/** 'sit'/'walk_sit' are legacy values on pre-catalog bookings (display only). */
export type BookingServiceType = ServiceType | "sit" | "walk_sit";
export type BookingStatus =
  | "requested" | "accepted" | "in_progress" | "completed" | "declined" | "cancelled" | "expired";

export interface QuoteLine {
  label: string;
  amount: number;
}
export interface Quote {
  currency: string;
  lines: QuoteLine[];
  total: number;
  pricingVersion: number;
}

export interface BookingSummary {
  id: string;
  serviceType: BookingServiceType;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  quotedTotal: string | number | null;
  currency: string;
  isSharedWalk: boolean;
  seriesId: string | null;
  seriesIndex: number | null;
  role: "walker" | "customer";
  counterpartName: string;
}

export interface BookingSegment {
  segmentType: "walk" | "daycare" | "boarding" | "drop_in" | "sit";
  startAt: string;
  endAt: string;
  locationType: string;
  status: string;
}

export interface BookingDetail extends Omit<BookingSummary, never> {
  priceBreakdown: Quote | null;
  dropoffRequired: boolean;
  specialInstructions: string | null;
  /** Set when the walker actually starts/finishes (anti-fraud tracking). */
  actualStartAt: string | null;
  actualEndAt: string | null;
  /** True when the walk/sit finished meaningfully short of the booked duration. */
  endedEarly: boolean;
  /** True when no halfway photo was captured during the walk. */
  missedMidPhoto: boolean;
  /** The walker on this booking — powers the post-review "save walker" prompt. */
  walkerId: string;
  /** When the walker confirmed the pets match their profiles (null = not yet). */
  petsConfirmedAt: string | null;
  pets: BookingPet[];
  segments: BookingSegment[];
}

/** A pet as attached to a booking — what the walker sees at handoff. */
export interface BookingPet {
  id: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  photoUrl: string | null;
  friendlyWithPets: FriendlyWithPets;
  size: PetSize | null;
  notes: string | null;
}

export type PetReportCategory =
  | "profile_mismatch"
  | "behavior_undisclosed"
  | "health_undisclosed"
  | "wrong_pet"
  | "other";
export type PetReportStatus = "open" | "reviewed" | "dismissed";

export const PET_REPORT_CATEGORY_LABELS: Record<PetReportCategory, string> = {
  profile_mismatch: "Profile doesn't match the pet",
  behavior_undisclosed: "Behavior issues not disclosed",
  health_undisclosed: "Health issue not disclosed",
  wrong_pet: "Different pet than booked",
  other: "Something else",
};

export interface PetReport {
  id: string;
  bookingId: string;
  petId: string;
  category: PetReportCategory;
  note: string | null;
  status: PetReportStatus;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// ---- Service debrief (walker's internal post-service report) ----

export type DebriefPetAsDescribed = "yes" | "mostly" | "no";
export type DebriefOwnerCommunication = "great" | "fine" | "difficult";
export type DebriefHandoff = "smooth" | "minor_issues" | "problematic";
export type DebriefWorkAgain = "yes" | "maybe" | "no";

export interface DebriefInput {
  overall: number; // 1-5
  petAsDescribed: DebriefPetAsDescribed;
  ownerCommunication: DebriefOwnerCommunication;
  handoff: DebriefHandoff;
  workAgain: DebriefWorkAgain;
  note?: string;
}

/** Admin analytics view of a submitted debrief. */
export interface AdminDebrief {
  id: string;
  bookingId: string;
  skipped: boolean;
  overall: number;
  petAsDescribed: DebriefPetAsDescribed;
  ownerCommunication: DebriefOwnerCommunication;
  handoff: DebriefHandoff;
  workAgain: DebriefWorkAgain;
  note: string | null;
  createdAt: string;
  walkerName: string;
  ownerName: string;
  serviceType: BookingServiceType;
  startAt: string;
}

export interface DebriefStats {
  submitted: number;
  skipped: number;
  avgOverall: number | null;
  workAgainYesPct: number | null;
  petMismatchPct: number | null;
}

// ---- Cash-commission settlement (walker owes platform for cash bookings) ----

export type SettlementRail = "whish" | "omt" | "bob";
export type SettlementStatus = "pending" | "confirmed" | "rejected";

export interface Settlement {
  id: string;
  walkerId: string;
  amount: number | string;
  currency: string;
  method: SettlementRail;
  reference: string;
  destination: string | null;
  status: SettlementStatus;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminSettlement extends Settlement {
  walkerName: string;
}

export interface CashBalance {
  balances: { currency: string; amount: number }[];
  threshold: number;
  blocked: boolean;
  pendingSettlement: Settlement | null;
}

/** Admin-queue view of a pet report (joined context). */
export interface AdminPetReport extends PetReport {
  petName: string;
  petSpecies: PetSpecies;
  petBreed: string | null;
  petPhotoUrl: string | null;
  walkerName: string;
  ownerName: string;
}

export type PaymentStatus = "none" | "pending" | "held" | "captured" | "refunded" | "failed";

/** Rails a customer can pay with. Card is Stripe; the rest are Lebanon rails + cash. */
export type PaymentMethod = "card" | "whish" | "omt" | "bob" | "cash";

/** Public payment state for a booking (both parties may read it). */
export interface PaymentView {
  status: PaymentStatus;
  amount: number;
  currency: string;
  refundedAmount: number;
  /** Chosen rail once a payment exists; null before the customer picks one. */
  method: PaymentMethod | null;
  /** Reconciliation reference for a manual rail (null for card/cash). */
  reference: string | null;
  /** Destination handle to pay into on a manual rail (null for card/cash). */
  destination: string | null;
  /** True once the customer self-reported paying a manual rail. */
  payerMarkedPaid: boolean;
  /** Methods on offer while nothing is committed yet. */
  methods: PaymentMethod[];
}

/** Backend response after the customer commits to a manual rail or cash. */
export interface ManualPaymentResult {
  method: Exclude<PaymentMethod, "card">;
  reference: string | null;
  destination: string | null;
  amount: number;
  currency: string;
}

/** What the backend returns to mount Stripe Elements and confirm the hold. */
export interface PaymentIntentResult {
  clientSecret: string;
  publishableKey: string | null;
  providerRef: string;
  amount: number;
  currency: string;
}

export type DisputeReason =
  | "ended_early"
  | "missing_photos"
  | "no_show"
  | "pet_welfare"
  | "other";

/** Why a walker declined a request (internal — owners never see it verbatim). */
export type DeclineReason =
  | "unavailable"
  | "too_far"
  | "dog_fit"
  | "too_many_dogs"
  | "special_needs"
  | "uncomfortable"
  | "other";

/** A customer-raised problem with a booking. Null when none has been opened. */
export interface Dispute {
  id: string;
  reason: DisputeReason;
  note: string | null;
  status: "open" | "resolved" | "rejected";
  resolution: "refund_full" | "refund_partial" | "denied" | null;
  refundAmount: number;
  createdAt: string;
  resolvedAt: string | null;
}

export type DisputeResolution = "refund_full" | "refund_partial" | "denied";

/** A dispute enriched with booking context, for the admin review queue. */
export interface AdminDispute {
  id: string;
  reason: DisputeReason;
  note: string | null;
  status: "open" | "resolved" | "rejected";
  resolution: DisputeResolution | null;
  refundAmount: number;
  createdAt: string;
  resolvedAt: string | null;
  bookingId: string;
  customerName: string;
  walkerName: string;
  serviceType: string;
  startAt: string;
  bookingStatus: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  refundedAmount: number;
  walkerLiable: boolean;
  walkerDeduction: number;
  endedEarly: boolean;
  missedMidPhoto: boolean;
}

export type WalkCheckpoint = "start" | "mid" | "end";

/** A live photo the walker captured at a checkpoint (image served separately). */
export interface WalkPhoto {
  checkpoint: WalkCheckpoint;
  takenAt: string;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewerName: string;
}

export interface WalkerReviews {
  reviews: Review[];
  ratingAvg: number;
  ratingCount: number;
}

/** Caller's own review on a booking (no reviewerName — it's theirs). */
export interface OwnReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface BookingReviewState {
  eligible: boolean;
  review: OwnReview | null;
}

export interface ReviewInput {
  bookingId: string;
  rating: number;
  comment?: string;
}

export type FriendlyWithPets = "friendly" | "selective" | "not_friendly";
export type PetSize = "small" | "medium" | "large";
export type PetSpecies = "dog" | "cat";

export const SPECIES_LABELS: Record<PetSpecies, string> = {
  dog: "Dog",
  cat: "Cat",
};

export interface Pet {
  id: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  ageYears: number | null;
  size: PetSize | null;
  weightKg: number | null;
  friendlyWithPets: FriendlyWithPets;
  notes: string | null;
  photoUrl: string | null;
  createdAt: string;
}

/** Payload for create/update (no id / server fields). */
export interface PetInput {
  name: string;
  species: PetSpecies;
  breed?: string | null;
  ageYears?: number | null;
  size?: PetSize | null;
  weightKg?: number | null;
  friendlyWithPets: FriendlyWithPets;
  notes?: string | null;
  photoUrl?: string | null;
}

export const FRIENDLY_LABELS: Record<FriendlyWithPets, string> = {
  friendly: "Friendly with other dogs",
  selective: "Selective / depends",
  not_friendly: "Prefers to be alone",
};

/** Species-aware temperament label — "other dogs" only makes sense for dogs. */
export function friendlyLabel(species: PetSpecies, v: FriendlyWithPets): string {
  if (v === "friendly" && species === "cat") return "Friendly with other pets";
  return FRIENDLY_LABELS[v];
}

export const SIZE_LABELS: Record<PetSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};
