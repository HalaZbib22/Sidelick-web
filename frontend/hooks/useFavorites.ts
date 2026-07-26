"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { api } from "../lib/paths";
import type { WalkerCard, WalkerProfile } from "../lib/types";

/**
 * Toggle a walker in the caller's favorites, optimistically.
 * The heart flips instantly across every walkers list and the open profile;
 * on failure the caches roll back and a toast explains.
 */
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ walkerId, next }: { walkerId: string; next: boolean }) =>
      apiFetch<{ walkerId: string; isFavorite: boolean }>(api.walkerFavorite(walkerId), {
        method: next ? "PUT" : "DELETE",
      }),

    onMutate: async ({ walkerId, next }) => {
      await qc.cancelQueries({ queryKey: ["walkers"] });
      await qc.cancelQueries({ queryKey: ["walker", walkerId] });

      const prevLists = qc.getQueriesData<WalkerCard[]>({ queryKey: ["walkers"] });
      const prevProfile = qc.getQueryData<WalkerProfile>(["walker", walkerId]);

      qc.setQueriesData<WalkerCard[]>({ queryKey: ["walkers"] }, (old) =>
        old?.map((w) => (w.id === walkerId ? { ...w, isFavorite: next } : w))
      );
      qc.setQueryData<WalkerProfile>(["walker", walkerId], (old) =>
        old ? { ...old, isFavorite: next } : old
      );

      return { prevLists, prevProfile };
    },

    onError: (_err, { walkerId }, ctx) => {
      ctx?.prevLists?.forEach(([key, data]) => qc.setQueryData(key, data));
      if (ctx?.prevProfile) qc.setQueryData(["walker", walkerId], ctx.prevProfile);
      toast.error("Couldn't update your saved walkers — try again.");
    },

    onSettled: (_data, _err, { walkerId }) => {
      qc.invalidateQueries({ queryKey: ["walkers"] });
      qc.invalidateQueries({ queryKey: ["walker", walkerId] });
    },
  });
}
