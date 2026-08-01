"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { api } from "../lib/paths";
import type { AdminPetReport } from "../lib/types";

export function useAdminPetReports(status?: "open" | "reviewed" | "dismissed") {
  return useQuery({
    queryKey: ["admin", "pet-reports", status ?? "all"],
    queryFn: async () => {
      const qs = status ? `?status=${status}` : "";
      return (
        await apiFetch<{ reports: AdminPetReport[] }>(`${api.adminPetReports}${qs}`)
      ).reports;
    },
  });
}

export function useReviewPetReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; action: "reviewed" | "dismissed"; note?: string }) =>
      apiFetch(api.adminReviewPetReport(input.id), {
        method: "POST",
        body: JSON.stringify({ action: input.action, note: input.note }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "pet-reports"] }),
  });
}
