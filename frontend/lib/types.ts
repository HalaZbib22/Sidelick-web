export type Role = "user" | "walker" | "admin";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type ServiceType = "walk" | "sit";
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
  maxPackSize: number | null;
  maxBoardingPets: number | null;
  verificationStatus: VerificationStatus;
}

export interface WalkerCard {
  id: string;
  firstName: string;
  lastInitial: string;
  serviceTypes: ServiceType[];
  subscriptionTier: string | null;
  latitude: number | null;
  longitude: number | null;
  profilePhotoUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  distanceKm: number | null;
  priceFrom: number | null;
}

export interface WalkerProfile {
  id: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  serviceTypes: ServiceType[];
  subscriptionTier: string | null;
  profilePhotoUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  priceFrom: number | null;
}

export type BookingServiceType = "walk" | "sit" | "walk_sit";
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
  segmentType: "walk" | "sit";
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
  segments: BookingSegment[];
}

export type PaymentStatus = "none" | "pending" | "held" | "captured" | "refunded" | "failed";

/** Public payment state for a booking (both parties may read it). */
export interface PaymentView {
  status: PaymentStatus;
  amount: number;
  currency: string;
  refundedAmount: number;
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

export interface Pet {
  id: string;
  name: string;
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

export const SIZE_LABELS: Record<PetSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};
