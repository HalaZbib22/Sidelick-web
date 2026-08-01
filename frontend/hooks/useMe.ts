"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { api } from "../lib/paths";
import { getStoredSession } from "../lib/auth";
import type { Me } from "../lib/types";

/** The current authenticated user's profile (role, verification status, etc.).
 *  Only runs when a session hint is present (so it's inert on public pages). */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    enabled: !!getStoredSession(),
    queryFn: async () => {
      const data = await apiFetch<{ user: Me }>(api.me);
      return data.user;
    },
  });
}
