"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">My pets</h1>
        {!mode && pets && pets.length > 0 && (
          <Button onClick={() => setMode({ type: "add" })}>
            <Plus className="h-4 w-4" />
            Add pet
          </Button>
        )}
      </header>

      {mode && (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
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
        <p className="text-sm text-red-600">Couldn&apos;t load your pets. Please refresh.</p>
      ) : !pets || pets.length === 0 ? (
        !mode && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No pets yet. Add your first dog to start booking care.
            </p>
            <Button className="mt-4" onClick={() => setMode({ type: "add" })}>
              <Plus className="h-4 w-4" />
              Add pet
            </Button>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {pets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              onEdit={(p) => setMode({ type: "edit", pet: p })}
              onDelete={handleDelete}
              deleting={remove.isPending}
            />
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
