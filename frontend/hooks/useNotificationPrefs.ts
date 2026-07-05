"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { api } from "../lib/paths";
import { useAuth } from "../contexts/AuthContext";

/** The mutable per-category notification toggles (mirrors backend migration 0010). */
export interface NotificationPrefs {
  booking_updates: boolean;
  reviews: boolean;
  reminders: boolean;
}

interface PrefsResponse {
  preferences: NotificationPrefs;
}

const KEY = ["notification-preferences"] as const;

/**
 * Loads the caller's notification category preferences and exposes an optimistic
 * setter. Each toggle PUTs a partial update; the backend merges it and returns
 * the full, normalized set which we write back into the cache.
 */
export function useNotificationPrefs() {
  const { session } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<PrefsResponse>(api.notificationPreferences),
    enabled: !!session,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) =>
      apiFetch<PrefsResponse>(api.notificationPreferences, {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    // Optimistic: flip the switch immediately, roll back on failure.
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<PrefsResponse>(KEY);
      if (previous) {
        qc.setQueryData<PrefsResponse>(KEY, {
          preferences: { ...previous.preferences, ...patch },
        });
      }
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
      toast.error("Couldn't save that change. Please try again.");
    },
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });

  return {
    prefs: query.data?.preferences,
    isLoading: query.isLoading,
    setPref: (category: keyof NotificationPrefs, value: boolean) =>
      mutation.mutate({ [category]: value }),
  };
}
