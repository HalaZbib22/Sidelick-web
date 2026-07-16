"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { api } from "../lib/paths";
import type {
  PaymentView,
  PaymentIntentResult,
  PaymentMethod,
  ManualPaymentResult,
} from "../lib/types";

/** Payment config: which methods are on offer and the Stripe key for card Elements. */
export function usePaymentConfig() {
  return useQuery({
    queryKey: ["payment-config"],
    queryFn: () =>
      apiFetch<{
        configured: boolean;
        cardConfigured: boolean;
        publishableKey: string | null;
        methods: PaymentMethod[];
      }>(api.paymentConfig),
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

/**
 * Commit a booking to a manual rail (Whish / OMT / BOB) or cash. Returns the
 * reference + destination the customer pays into, then refetches the view.
 */
export function useSelectMethod(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (method: Exclude<PaymentMethod, "card">) =>
      (
        await apiFetch<{ payment: ManualPaymentResult }>(api.bookingPaymentMethod(id), {
          method: "POST",
          body: JSON.stringify({ method }),
        })
      ).payment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment", id] });
    },
  });
}

/** Customer reports they've sent the money on a manual rail (→ admin confirm queue). */
export function useMarkPaid(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      apiFetch<{ marked: boolean }>(api.bookingPaymentMarkPaid(id), { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment", id] });
    },
  });
}
