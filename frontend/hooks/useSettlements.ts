"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { api } from "../lib/paths";
import type { AdminSettlement, CashBalance, Settlement, SettlementRail } from "../lib/types";

/** Walker's cash-commission balance + block state + in-flight settlement. */
export function useCashBalance(enabled = true) {
  return useQuery({
    queryKey: ["cash-balance"],
    enabled,
    queryFn: async () => apiFetch<CashBalance>(api.meCashBalance),
  });
}

/** Walker opens a settlement over a manual rail. */
export function useCreateSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (method: SettlementRail) =>
      apiFetch<{ settlement: Settlement }>(api.meSettlements, {
        method: "POST",
        body: JSON.stringify({ method }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cash-balance"] }),
  });
}

// ---- Admin ----

export function useAdminSettlements(status?: "pending" | "confirmed" | "rejected") {
  return useQuery({
    queryKey: ["admin", "settlements", status ?? "all"],
    queryFn: async () => {
      const qs = status ? `?status=${status}` : "";
      return (
        await apiFetch<{ settlements: AdminSettlement[] }>(`${api.adminSettlements}${qs}`)
      ).settlements;
    },
  });
}

export function useReviewSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; action: "confirm" | "reject"; note?: string }) =>
      apiFetch(api.adminReviewSettlement(input.id), {
        method: "POST",
        body: JSON.stringify({ action: input.action, note: input.note }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "settlements"] }),
  });
}
