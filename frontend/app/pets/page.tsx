"use client";

import { useState } from "react";
import { PawPrint, Plus } from "lucide-react";
import { toast } from "sonner";
import { Protected } from "../../components/auth/Protected";
import { Button } from "../../components/ui/Button";
import { PetCard } from "../../components/pets/PetCard";
import { PetForm } from "../../components/pets/PetForm";
import { ListSkeleton, PetCardSkeleton } from "../../components/ui/Skeleton";
import { usePets, usePetMutations } from "../../hooks/usePets";
import { getApiErrorMessage } from "../../lib/forms";
import type { Pet, PetInput } from "../../lib/types";

function PetsInner() {
  const { data: pets, isLoading, isError } = usePets();
  const { create, update, remove } = usePetMutations();
  const [mode, setMode] = useState<{ type: "add" } | { type: "edit"; pet: Pet } | null>(null);

  const closeForm = () => setMode(null);

  const handleSubmit = async (input: PetInput) => {
    if (mode?.type === "edit") {
      await update.mutateAsync({ id: mode.pet.id, input });
    } else {
      await create.mutateAsync(input);
    }
    closeForm();
  };

  const handleDelete = async (pet: Pet) => {
    if (!window.confirm(`Remove ${pet.name}?`)) return;
    try {
      await remove.mutateAsync(pet.id);
      toast.success("Pet removed");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const count = pets?.length ?? 0;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      {/* Ambient hero band */}
      <header className="relative mb-6 overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-accent-subtle/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-trust-subtle/60 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your pack
            </p>
            <h1 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">My pets</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {count === 0
                ? "Add your first pet to start booking care."
                : `${count} ${count === 1 ? "companion" : "companions"} in your care`}
            </p>
          </div>
          {!mode && count > 0 && (
            <Button onClick={() => setMode({ type: "add" })}>
              <Plus className="h-4 w-4" />
              Add pet
            </Button>
          )}
        </div>
      </header>

      {mode && (
        <div className="slk-rise mb-6 rounded-2xl border border-border bg-surface p-5 shadow-md">
          <h2 className="font-display mb-4 text-xl font-medium">
            {mode.type === "edit" ? `Edit ${mode.pet.name}` : "Add a pet"}
          </h2>
          <PetForm
            initial={mode.type === "edit" ? mode.pet : undefined}
            onSubmit={handleSubmit}
            onCancel={closeForm}
          />
        </div>
      )}

      {isLoading ? (
        <ListSkeleton count={2}>
          <PetCardSkeleton />
        </ListSkeleton>
      ) : isError ? (
        <p className="text-sm text-danger">Couldn&apos;t load your pets. Please refresh.</p>
      ) : count === 0 ? (
        !mode && (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent-subtle to-trust-subtle">
              <PawPrint className="h-6 w-6 text-primary" />
            </span>
            <p className="font-display mt-4 text-lg font-semibold">No pets yet</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              Tell us about your pet — walkers see their profile before every booking.
            </p>
            <Button className="mt-5" onClick={() => setMode({ type: "add" })}>
              <Plus className="h-4 w-4" />
              Add your first pet
            </Button>
          </div>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pets!.map((pet, i) => (
            <div
              key={pet.id}
              className="slk-rise"
              style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}
            >
              <PetCard
                pet={pet}
                onEdit={(p) => setMode({ type: "edit", pet: p })}
                onDelete={handleDelete}
                deleting={remove.isPending}
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default function PetsPage() {
  return (
    <Protected>
      <PetsInner />
    </Protected>
  );
}
