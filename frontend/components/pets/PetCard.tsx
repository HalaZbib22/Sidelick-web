"use client";

import { Pencil, Trash2 } from "lucide-react";
import { FRIENDLY_LABELS, SIZE_LABELS, type Pet } from "../../lib/types";

interface PetCardProps {
  pet: Pet;
  onEdit: (pet: Pet) => void;
  onDelete: (pet: Pet) => void;
  deleting?: boolean;
}

export function PetCard({ pet, onEdit, onDelete, deleting }: PetCardProps) {
  const meta = [
    pet.breed,
    pet.size ? SIZE_LABELS[pet.size] : null,
    pet.ageYears != null ? `${pet.ageYears} yr` : null,
    pet.weightKg != null ? `${pet.weightKg} kg` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{pet.name}</h3>
          {meta.length > 0 && (
            <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
          )}
          <span
            className={
              "mt-2 inline-block rounded-full px-2 py-0.5 text-xs " +
              (pet.friendlyWithPets === "friendly"
                ? "bg-trust-subtle text-trust-strong"
                : "bg-muted text-muted-foreground")
            }
          >
            {FRIENDLY_LABELS[pet.friendlyWithPets]}
          </span>
          {pet.notes && <p className="mt-2 text-sm text-muted-foreground">{pet.notes}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => onEdit(pet)}
            aria-label={`Edit ${pet.name}`}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(pet)}
            disabled={deleting}
            aria-label={`Delete ${pet.name}`}
            className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
