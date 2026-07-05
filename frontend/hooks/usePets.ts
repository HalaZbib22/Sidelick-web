"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { api } from "../lib/paths";
import type { Pet, PetInput } from "../lib/types";

const KEY = ["pets"] as const;

/** List the current user's pets. */
export function usePets() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const data = await apiFetch<{ pets: Pet[] }>(api.pets);
      return data.pets;
    },
  });
}

/** Create / update / delete with cache invalidation. */
export function usePetMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: (input: PetInput) =>
      apiFetch<{ pet: Pet }>(api.pets, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PetInput> }) =>
      apiFetch<{ pet: Pet }>(api.pet(id), { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<{ id: string }>(api.pet(id), { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
