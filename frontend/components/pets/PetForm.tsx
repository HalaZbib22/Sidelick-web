"use client";

import { toast } from "sonner";
import { FormField } from "../ui/FormField";
import { SelectField } from "../ui/SelectField";
import { TextareaField } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { useForm } from "../../hooks/useForm";
import {
  FRIENDLY_LABELS,
  SIZE_LABELS,
  type Pet,
  type PetInput,
  type FriendlyWithPets,
  type PetSize,
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

interface PetFormProps {
  initial?: Pet;
  onSubmit: (input: PetInput) => Promise<void>;
  onCancel: () => void;
}

const friendlyOptions = (Object.keys(FRIENDLY_LABELS) as FriendlyWithPets[]).map((v) => ({
  value: v,
  label: FRIENDLY_LABELS[v],
}));
const sizeOptions = (Object.keys(SIZE_LABELS) as PetSize[]).map((v) => ({
  value: v,
  label: SIZE_LABELS[v],
}));

export function PetForm({ initial, onSubmit, onCancel }: PetFormProps) {
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
      const input: PetInput = {
        name: v.name.trim(),
        breed: v.breed.trim() || null,
        ageYears: v.ageYears.trim() === "" ? null : Number(v.ageYears),
        size: (v.size || null) as PetSize | null,
        weightKg: v.weightKg.trim() === "" ? null : Number(v.weightKg),
        friendlyWithPets: v.friendlyWithPets as FriendlyWithPets,
        notes: v.notes.trim() || null,
      };
      await onSubmit(input);
      toast.success(initial ? "Pet updated" : "Pet added");
    },
  });

  return (
    <form onSubmit={form.handleSubmit} noValidate className="space-y-4">
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
          placeholder="e.g. Labrador"
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
        label="Temperament with other dogs"
        options={friendlyOptions}
        value={form.values.friendlyWithPets}
        onChange={(e) => form.handleChange("friendlyWithPets", e.target.value)}
      />
      <p className="-mt-2 text-xs text-muted-foreground">
        Only dogs marked “friendly” can join cheaper shared (group) walks.
      </p>
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
