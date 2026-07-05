"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { api } from "../lib/paths";
import type { PaymentView, PaymentIntentResult } from "../lib/types";

/** Whether the platform has a payment provider configured (drives whether we show the pay UI at all). */
export function usePaymentConfig() {
  return useQuery({
    queryKey: ["payment-config"],
    queryFn: () =>
      apiFetch<{ configured: boolean; publishableKey: string | null }>(api.paymentConfig),
    staleTime: 5 * 60 * 1000,
  });
}

/** Current escrow state of a booking's payment (both parties may read it). */
export function usePaymentView(id: string, enabled = true) {
  return useQuery({
    queryKey: ["payment", id],
    enabled,
    queryFn: async () =>
      (await apiFetch<{ payment: PaymentView }>(api.bookingPayment(id))).payment,
  });
}

/**
 * Creates (or reuses) the authorization-hold PaymentIntent for a booking and
 * returns the clientSecret + publishableKey needed to mount Stripe Elements.
 */
export function useCreateIntent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await apiFetch<{ intent: PaymentIntentResult }>(api.bookingPaymentIntent(id), { method: "POST" }))
        .intent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment", id] });
    },
  });
}
