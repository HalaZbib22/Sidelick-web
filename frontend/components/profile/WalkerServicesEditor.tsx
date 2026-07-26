"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Cat, Dog, Home, Pencil } from "lucide-react";
import { SERVICES, SERVICE_CHIP, SERVICE_META } from "../../lib/services";
import { Button } from "../ui/Button";
import { NumberStepper } from "../ui/NumberStepper";
import { AmenityPicker } from "../walkers/AmenityChips";
import { apiFetch } from "../../lib/api";
import { api } from "../../lib/paths";
import { getApiErrorMessage } from "../../lib/forms";
import { AMENITY_LABEL } from "../../lib/amenities";
import type { Me, ServiceType } from "../../lib/types";

/** How many amenity chips to show in view mode before collapsing to "+n". */
const PREVIEW_CHIPS = 6;

/**
 * Walker-only card on the profile page: view + edit services, capacity and
 * amenities after onboarding. Saves via PATCH /me/walker-profile and
 * refreshes the me cache, so discovery reflects changes immediately.
 */
export function WalkerServicesEditor({ me }: { me: Me }) {
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Draft state, seeded from the profile each time editing opens.
  const [services, setServices] = useState<ServiceType[]>([]);
  const [maxPackSize, setMaxPackSize] = useState(4);
  const [maxBoardingPets, setMaxBoardingPets] = useState(3);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [acceptedSpecies, setAcceptedSpecies] = useState<string[]>(["dog"]);

  const walk = services.includes("walk");
  const hosting = services.includes("daycare") || services.includes("boarding");
  const toggleService = (s: ServiceType) =>
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  function openEditor() {
    setServices(me.serviceTypes ?? []);
    setMaxPackSize(me.maxPackSize ?? 4);
    setMaxBoardingPets(me.maxBoardingPets ?? 3);
    setAmenities(me.amenities ?? []);
    setAcceptedSpecies(me.acceptedSpecies ?? ["dog"]);
    setEditing(true);
  }

  async function save() {
    if (services.length === 0) {
      return toast.error("Keep at least one service active.");
    }
    if (acceptedSpecies.length === 0) {
      return toast.error("Keep at least one pet type active.");
    }
    setBusy(true);
    try {
      await apiFetch(api.meWalkerProfile, {
        method: "PATCH",
        body: JSON.stringify({
          serviceTypes: services,
          amenities,
          acceptedSpecies,
          maxPackSize: walk ? maxPackSize : undefined,
          maxBoardingPets: hosting ? maxBoardingPets : undefined,
        }),
      });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Services & skills updated");
      setEditing(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const ownedLabels = (me.amenities ?? [])
    .map((id) => AMENITY_LABEL[id])
    .filter(Boolean);

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-medium">Services &amp; skills</h2>
        {!editing && (
          <button
            type="button"
            onClick={openEditor}
            className="lift inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium shadow-sm hover:shadow-md"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(me.serviceTypes ?? []).map((s) => {
              const meta = SERVICE_META[s];
              if (!meta) return null;
              const Icon = meta.icon;
              const cap =
                s === "walk"
                  ? me.maxPackSize
                  : s === "boarding" || s === "daycare"
                    ? me.maxBoardingPets
                    : null;
              return (
                <span
                  key={s}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${SERVICE_CHIP[s]}`}
                >
                  <Icon className="h-3 w-3" /> {meta.label}
                  {cap != null && ` · up to ${cap}`}
                </span>
              );
            })}
            {(me.acceptedSpecies ?? ["dog"]).includes("cat") && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-3 py-1 text-xs font-medium text-link">
                <Cat className="h-3 w-3" /> Cares for cats
              </span>
            )}
          </div>
          {ownedLabels.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {ownedLabels.slice(0, PREVIEW_CHIPS).map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                >
                  {label}
                </span>
              ))}
              {ownedLabels.length > PREVIEW_CHIPS && (
                <button
                  type="button"
                  onClick={openEditor}
                  className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-link hover:opacity-80"
                >
                  +{ownedLabels.length - PREVIEW_CHIPS} more
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No skills added yet — add First aid / CPR, Fenced garden and more so owners can find you.
            </p>
          )}
        </div>
      ) : (
        <AnimatePresence initial={!reduce}>
          <motion.div
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {SERVICES.map((s) => (
                  <ServiceToggle
                    key={s.value}
                    icon={s.icon}
                    label={s.label}
                    selected={services.includes(s.value)}
                    onClick={() => toggleService(s.value)}
                  />
                ))}
              </div>
              {walk && (
                <NumberStepper
                  label="Max dogs per group walk"
                  value={maxPackSize}
                  onChange={setMaxPackSize}
                  min={1}
                  max={4}
                />
              )}
              {hosting && (
                <NumberStepper
                  label="Max pets you can host at home"
                  value={maxBoardingPets}
                  onChange={setMaxBoardingPets}
                  min={1}
                  max={3}
                />
              )}
              <div>
                <p className="mb-1.5 text-sm font-medium">Who do you care for?</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "dog", label: "Dogs", icon: Dog },
                      { value: "cat", label: "Cats", icon: Cat },
                    ] as const
                  ).map(({ value, label, icon: Icon }) => {
                    const on = acceptedSpecies.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setAcceptedSpecies((prev) =>
                            on ? prev.filter((s) => s !== value) : [...prev, value]
                          )
                        }
                        className={`flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                          on
                            ? "border-primary bg-accent-subtle/60 text-foreground shadow-sm"
                            : "border-border bg-surface text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${on ? "text-primary" : ""}`} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <AmenityPicker value={amenities} onChange={setAmenities} />
              <div className="flex gap-2">
                <Button onClick={save} loading={busy} className="flex-1">
                  Save changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditing(false)}
                  disabled={busy}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function ServiceToggle({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
        selected
          ? "border-primary bg-accent-subtle/60 text-foreground shadow-sm"
          : "border-border bg-surface text-muted-foreground hover:bg-muted"
      }`}
    >
      <Icon className={`h-4 w-4 ${selected ? "text-primary" : ""}`} />
      {label}
    </button>
  );
}
