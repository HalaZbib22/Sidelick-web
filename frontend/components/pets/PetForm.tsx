"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Cat, Dog, X } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { api } from "../../lib/paths";
import { FormField } from "../ui/FormField";
import { SelectField } from "../ui/SelectField";
import { TextareaField } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { useForm } from "../../hooks/useForm";
import {
  FRIENDLY_LABELS,
  friendlyLabel,
  SIZE_LABELS,
  type Pet,
  type PetInput,
  type FriendlyWithPets,
  type PetSize,
  type PetSpecies,
} from "../../lib/types";
import { validateName, validateBreed, validateAge } from "../../lib/validation";

interface PetFormValues {
  name: string;
  breed: string;
  ageYears: string;
  size: string;
  weightKg: string;
  friendlyWithPets: string;
  notes: string;
}

const SPECIES_OPTIONS = [
  { value: "dog", label: "Dog", icon: Dog },
  { value: "cat", label: "Cat", icon: Cat },
] as const;

interface PetFormProps {
  initial?: Pet;
  onSubmit: (input: PetInput) => Promise<void>;
  onCancel: () => void;
}

const sizeOptions = (Object.keys(SIZE_LABELS) as PetSize[]).map((v) => ({
  value: v,
  label: SIZE_LABELS[v],
}));

export function PetForm({ initial, onSubmit, onCancel }: PetFormProps) {
  const [species, setSpecies] = useState<PetSpecies>(initial?.species ?? "dog");

  // Photo: a newly picked file, the existing URL, or nothing (removed/never set).
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.photoUrl ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : photoUrl),
    [photoFile, photoUrl]
  );
  useEffect(() => {
    // Revoke the last object URL when the file changes / on unmount.
    return () => {
      if (photoFile && preview) URL.revokeObjectURL(preview);
    };
  }, [photoFile, preview]);

  function pickPhoto(file: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return toast.error("Use a JPG, PNG, or WebP image.");
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error("Photo must be under 5MB.");
    }
    setPhotoFile(file);
  }

  const form = useForm<PetFormValues>({
    initialValues: {
      name: initial?.name ?? "",
      breed: initial?.breed ?? "",
      ageYears: initial?.ageYears != null ? String(initial.ageYears) : "",
      size: initial?.size ?? "",
      weightKg: initial?.weightKg != null ? String(initial.weightKg) : "",
      friendlyWithPets: initial?.friendlyWithPets ?? "selective",
      notes: initial?.notes ?? "",
    },
    validators: {
      name: (v) => validateName(v, "Pet name"),
      breed: (v) => validateBreed(v),
      ageYears: (v) => (v.trim() === "" ? { isValid: true } : validateAge(v)),
    },
    onError: (msg) => toast.error(msg),
    onSubmit: async (v) => {
      // Upload the photo first (if newly picked) so the pet saves atomically.
      let finalPhotoUrl = photoUrl;
      if (photoFile) {
        const fd = new FormData();
        fd.append("image", photoFile);
        const d = await apiFetch<{ url: string }>(api.uploadImage, {
          method: "POST",
          body: fd,
        });
        finalPhotoUrl = d.url;
      }
      const input: PetInput = {
        name: v.name.trim(),
        species,
        breed: v.breed.trim() || null,
        ageYears: v.ageYears.trim() === "" ? null : Number(v.ageYears),
        size: (v.size || null) as PetSize | null,
        weightKg: v.weightKg.trim() === "" ? null : Number(v.weightKg),
        friendlyWithPets: v.friendlyWithPets as FriendlyWithPets,
        notes: v.notes.trim() || null,
        photoUrl: finalPhotoUrl,
      };
      await onSubmit(input);
      toast.success(initial ? "Pet updated" : "Pet added");
    },
  });

  return (
    <form onSubmit={form.handleSubmit} noValidate className="space-y-4">
      {/* Photo — optional, but walkers use it to confirm the right pet at pickup. */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label={preview ? "Change photo" : "Add photo"}
            className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-accent/50 bg-gradient-to-br from-accent-subtle to-trust-subtle transition hover:border-primary"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Pet photo preview" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-6 w-6 text-primary" />
            )}
            {preview && (
              <span className="absolute inset-0 flex items-center justify-center bg-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-5 w-5 text-white" />
              </span>
            )}
          </button>
          {preview && (
            <button
              type="button"
              onClick={() => {
                setPhotoFile(null);
                setPhotoUrl(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              aria-label="Remove photo"
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-muted-foreground shadow-md transition-colors hover:text-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{preview ? "Looking good!" : "Add a photo (optional)"}</p>
          <p className="text-xs text-muted-foreground">
            Helps your walker recognize {form.values.name.trim() || "your pet"} at a glance. JPG, PNG or WebP, up to 5MB.
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
        />
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium">Pet type</p>
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/40 p-1">
          {SPECIES_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSpecies(value)}
              aria-pressed={species === value}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                species === value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <FormField
        label="Pet name"
        placeholder="e.g. Luna"
        value={form.values.name}
        onChange={(e) => form.handleChange("name", e.target.value)}
        onBlur={() => form.handleBlur("name")}
        error={form.errors.name}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Breed (optional)"
          placeholder={species === "cat" ? "e.g. Persian" : "e.g. Labrador"}
          value={form.values.breed}
          onChange={(e) => form.handleChange("breed", e.target.value)}
          onBlur={() => form.handleBlur("breed")}
          error={form.errors.breed}
        />
        <FormField
          label="Age (years)"
          type="number"
          min={0}
          max={30}
          placeholder="e.g. 3"
          value={form.values.ageYears}
          onChange={(e) => form.handleChange("ageYears", e.target.value)}
          onBlur={() => form.handleBlur("ageYears")}
          error={form.errors.ageYears}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Size"
          placeholder="Select size"
          options={sizeOptions}
          value={form.values.size}
          onChange={(e) => form.handleChange("size", e.target.value)}
        />
        <FormField
          label="Weight (kg)"
          type="number"
          min={0}
          placeholder="e.g. 12"
          value={form.values.weightKg}
          onChange={(e) => form.handleChange("weightKg", e.target.value)}
        />
      </div>
      <SelectField
        label="Temperament with other pets"
        options={(Object.keys(FRIENDLY_LABELS) as FriendlyWithPets[]).map((v) => ({
          value: v,
          label: friendlyLabel(species, v),
        }))}
        value={form.values.friendlyWithPets}
        onChange={(e) => form.handleChange("friendlyWithPets", e.target.value)}
      />
      {species === "dog" && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Only dogs marked “friendly” can join cheaper shared (group) walks.
        </p>
      )}
      <TextareaField
        label="Notes (optional)"
        placeholder="Allergies, medication, behaviour, anything a walker should know…"
        value={form.values.notes}
        onChange={(e) => form.handleChange("notes", e.target.value)}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={form.isSubmitting}>
          {initial ? "Save changes" : "Add pet"}
        </Button>
      </div>
    </form>
  );
}
