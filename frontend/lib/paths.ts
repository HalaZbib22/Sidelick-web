/**
 * Centralized routes + API endpoints (single source of truth).
 * Never hardcode a path/endpoint in a component — import from here.
 * Mirrors api_endpoints.md.
 */

export const routes = {
  home: "/",
  signin: "/signin",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  unauthorized: "/unauthorized",
  pets: "/pets",
  profile: "/profile",
  notificationSettings: "/settings/notifications",
  admin: "/admin",
  walkers: "/walkers",
  bookings: "/bookings",
  booking: (id: string) => `/bookings/${id}`,
  walker: (id: string) => `/walkers/${id}`,
  walkerBook: (id: string) => `/walkers/${id}/book`,
  messages: "/messages",
} as const;

const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Socket.IO server origin (same host as the API, no /api prefix). */
export const socketUrl = base;

export const api = {
  // auth
  signup: `${base}/api/auth/signup`,
  signin: `${base}/api/auth/signin`,
  forgotPassword: `${base}/api/auth/forgot-password`,
  resetPassword: `${base}/api/auth/reset-password`,
  me: `${base}/api/me`,
  meWalkerProfile: `${base}/api/me/walker-profile`,
  meAvailability: `${base}/api/me/availability`,
  meVerification: `${base}/api/me/verification`,
  // admin
  adminUsers: `${base}/api/admin/users`,
  adminVerify: (id: string) => `${base}/api/admin/users/${id}/verify`,
  adminUserFile: (id: string, kind: "document" | "selfie") =>
    `${base}/api/admin/users/${id}/file/${kind}`,
  adminDisputes: `${base}/api/admin/disputes`,
  adminResolveDispute: (id: string) => `${base}/api/admin/disputes/${id}/resolve`,
  adminPendingPayments: `${base}/api/admin/payments/pending`,
  adminConfirmPayment: (bookingId: string) =>
    `${base}/api/admin/payments/${bookingId}/confirm`,
  // pets
  pets: `${base}/api/pets`,
  pet: (id: string) => `${base}/api/pets/${id}`,
  // discovery
  walkers: `${base}/api/walkers`,
  walker: (id: string) => `${base}/api/walkers/${id}`,
  walkerAvailability: (id: string) => `${base}/api/walkers/${id}/availability`,
  // bookings
  bookingQuote: `${base}/api/bookings/quote`,
  bookings: `${base}/api/bookings`,
  booking: (id: string) => `${base}/api/bookings/${id}`,
  bookingAction: (id: string, action: "accept" | "decline" | "cancel" | "start" | "complete") =>
    `${base}/api/bookings/${id}/${action}`,
  bookingPhoto: (id: string) => `${base}/api/bookings/${id}/photo`,
  bookingPhotos: (id: string) => `${base}/api/bookings/${id}/photos`,
  bookingPhotoFile: (id: string, checkpoint: "start" | "mid" | "end") =>
    `${base}/api/bookings/${id}/photos/${checkpoint}/file`,
  bookingDispute: (id: string) => `${base}/api/bookings/${id}/dispute`,
  // payments
  paymentConfig: `${base}/api/payments/config`,
  bookingPayment: (id: string) => `${base}/api/payments/bookings/${id}`,
  bookingPaymentIntent: (id: string) => `${base}/api/payments/bookings/${id}/intent`,
  bookingPaymentMethod: (id: string) => `${base}/api/payments/bookings/${id}/method`,
  bookingPaymentMarkPaid: (id: string) => `${base}/api/payments/bookings/${id}/mark-paid`,
  // reviews
  reviews: `${base}/api/reviews`,
  walkerReviews: (id: string) => `${base}/api/reviews/walker/${id}`,
  bookingReview: (bookingId: string) => `${base}/api/reviews/booking/${bookingId}`,
  // notifications
  notifications: `${base}/api/notifications`,
  notificationRead: (id: string) => `${base}/api/notifications/${id}/read`,
  notificationsReadAll: `${base}/api/notifications/read-all`,
  notificationPreferences: `${base}/api/notifications/preferences`,
  // web push
  pushVapidKey: `${base}/api/push/vapid-public-key`,
  pushSubscribe: `${base}/api/push/subscribe`,
  pushUnsubscribe: `${base}/api/push/unsubscribe`,
  // uploads
  uploadImage: `${base}/api/upload/image`,
  uploadVideo: `${base}/api/upload/video`,
  uploadMultiple: `${base}/api/upload/multiple`,
  // health
  health: `${base}/api/health`,
} as const;

/** Signup path with optional role query param. */
export function buildSignupPath(role?: "user" | "walker"): string {
  return role ? `${routes.signup}?role=${role}` : routes.signup;
}
