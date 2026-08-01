"use client";

import { Cat, Dog, Pencil, Trash2 } from "lucide-react";
import { friendlyLabel, SIZE_LABELS, type Pet } from "../../lib/types";

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
  ].filter(Boolean) as string[];

  return (
    <div className="lift h-full rounded-2xl border border-border bg-surface p-4 shadow-sm hover:shadow-md">
      <div className="flex items-start gap-3">
        {/* Avatar — photo if we have one, warm gradient monogram otherwise. */}
        {pet.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pet.photoUrl}
            alt={pet.name}
            className="h-12 w-12 shrink-0 rounded-full object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-subtle to-trust-subtle font-display text-lg font-semibold text-primary">
            {pet.name[0]?.toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-lg font-semibold leading-tight">
            {pet.name}
          </h3>
          {meta.length > 0 && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {meta.join(" · ")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => onEdit(pet)}
            aria-label={`Edit ${pet.name}`}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(pet)}
            disabled={deleting}
            aria-label={`Delete ${pet.name}`}
            className="rounded-full p-2 text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-medium text-link">
          {pet.species === "cat" ? (
            <>
              <Cat className="h-3 w-3" /> Cat
            </>
          ) : (
            <>
              <Dog className="h-3 w-3" /> Dog
            </>
          )}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs ${
            pet.friendlyWithPets === "friendly"
              ? "bg-trust-subtle text-trust-strong"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {friendlyLabel(pet.species, pet.friendlyWithPets)}
        </span>
      </div>

      {pet.notes && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {pet.notes}
        </p>
      )}
    </div>
  );
}
