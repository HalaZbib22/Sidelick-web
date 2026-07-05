"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { api } from "../lib/paths";
import type { WalkerReviews, BookingReviewState, ReviewInput } from "../lib/types";

export function useWalkerReviews(walkerId: string) {
  return useQuery({
    queryKey: ["walker-reviews", walkerId],
    queryFn: () => apiFetch<WalkerReviews>(api.walkerReviews(walkerId)),
  });
}

export function useBookingReview(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: ["booking-review", bookingId],
    enabled,
    queryFn: () => apiFetch<BookingReviewState>(api.bookingReview(bookingId)),
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewInput) =>
      apiFetch<{ review: { id: string } }>(api.reviews, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["booking-review", input.bookingId] });
      qc.invalidateQueries({ queryKey: ["walker-reviews"] });
      qc.invalidateQueries({ queryKey: ["walker"] });
    },
  });
}
