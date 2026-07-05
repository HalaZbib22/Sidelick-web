"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { api } from "../lib/paths";
import type { BookingSummary, BookingDetail, WalkPhoto, Dispute, DisputeReason } from "../lib/types";

export function useBookings() {
  return useQuery({
    queryKey: ["bookings"],
    queryFn: async () => (await apiFetch<{ bookings: BookingSummary[] }>(api.bookings)).bookings,
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: ["booking", id],
    queryFn: async () => (await apiFetch<{ booking: BookingDetail }>(api.booking(id))).booking,
  });
}

// Photo-free transitions only — start/complete now require a photo (see below).
type Action = "accept" | "decline" | "cancel";

export function useBookingAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: Action) => apiFetch(api.bookingAction(id, action), { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking", id] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

/**
 * Live walk photos (start / mid / end) the walker captured. Visible to both
 * parties. Pass `pollMs` (e.g. while the walk is in progress) to refetch so the
 * owner sees each photo appear without reloading.
 */
export function useWalkPhotos(id: string, pollMs?: number) {
  return useQuery({
    queryKey: ["walk-photos", id],
    queryFn: async () => (await apiFetch<{ photos: WalkPhoto[] }>(api.bookingPhotos(id))).photos,
    refetchInterval: pollMs,
  });
}

function photoForm(file: File) {
  const fd = new FormData();
  fd.append("photo", file);
  return fd;
}

/**
 * Walker photo actions that move the lifecycle: starting and completing both
 * require a fresh pet photo; the midpoint upload is optional. All three refresh
 * the booking + its photo gallery on success.
 */
export function useWalkPhotoAction(id: string, kind: "start" | "photo" | "complete") {
  const qc = useQueryClient();
  const url = kind === "photo" ? api.bookingPhoto(id) : api.bookingAction(id, kind);
  return useMutation({
    mutationFn: (file: File) => apiFetch(url, { method: "POST", body: photoForm(file) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking", id] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["walk-photos", id] });
    },
  });
}

/** The current dispute for a booking (open, else most recent), or null. */
export function useDispute(id: string, enabled = true) {
  return useQuery({
    queryKey: ["dispute", id],
    enabled,
    queryFn: async () => (await apiFetch<{ dispute: Dispute | null }>(api.bookingDispute(id))).dispute,
  });
}

/** Customer opens a dispute ("Report an issue"). Pauses the walker's payout. */
export function useOpenDispute(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: DisputeReason; note?: string }) =>
      apiFetch<{ dispute: Dispute }>(api.bookingDispute(id), {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dispute", id] });
      qc.invalidateQueries({ queryKey: ["booking", id] });
    },
  });
}
