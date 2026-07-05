"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { api } from "../lib/paths";
import type { AdminDispute, DisputeResolution } from "../lib/types";

/**
 * The admin dispute review queue. Pass a concrete status ("open") to filter, or
 * "all" to fetch every dispute (used for the history view, which must include
 * both resolved and rejected/denied outcomes).
 */
export function useAdminDisputes(status: string = "open") {
  return useQuery({
    queryKey: ["admin", "disputes", status],
    queryFn: async () => {
      const url = status === "all" ? api.adminDisputes : `${api.adminDisputes}?status=${status}`;
      return (await apiFetch<{ disputes: AdminDispute[] }>(url)).disputes;
    },
  });
}

interface ResolveInput {
  id: string;
  resolution: DisputeResolution;
  refundAmount?: number;
  /** false = platform goodwill (walker keeps full payout). Defaults to true. */
  walkerLiable?: boolean;
}

/** Resolve a dispute (full/partial refund or denied). Refreshes the queue. */
export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolution, refundAmount, walkerLiable }: ResolveInput) =>
      apiFetch<{ dispute: AdminDispute }>(api.adminResolveDispute(id), {
        method: "PATCH",
        body: JSON.stringify({ resolution, refundAmount, walkerLiable }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "disputes"] });
    },
  });
}
