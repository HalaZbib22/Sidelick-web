"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Protected } from "../../../../components/auth/Protected";
import { Button } from "../../../../components/ui/Button";
import { Skeleton } from "../../../../components/ui/Skeleton";
import { PillGroup } from "../../../../components/ui/PillGroup";
import { DateTimePicker } from "../../../../components/ui/DateTimePicker";
import { NumberStepper } from "../../../../components/ui/NumberStepper";
import { Switch } from "../../../../components/ui/Switch";
import { BackButton } from "../../../../components/ui/BackButton";
import { TextareaField } from "../../../../components/ui/Textarea";
import { usePets } from "../../../../hooks/usePets";
import { apiFetch } from "../../../../lib/api";
import { api, routes } from "../../../../lib/paths";
import { getApiErrorMessage } from "../../../../lib/forms";
import { cn } from "../../../../lib/utils";
import { SERVICES } from "../../../../lib/services";
import type { Pet, WalkerProfile, ServiceType, Quote } from "../../../../lib/types";

const money = (cur: string, n: number) => (cur === "USD" ? `$${n.toFixed(2)}` : `${n.toFixed(2)} ${cur}`);
const TOTAL = 3;
const pad = (n: number) => String(n).padStart(2, "0");
const dayISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Mirrors the backend rule: a start must be at least 30 min out.
const MIN_LEAD_MINUTES = 30;
/** A tidy default start: now + lead time, rounded up to the next 5 minutes. */
function earliestStart(): Date {
  const d = new Date(Date.now() + MIN_LEAD_MINUTES * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

function BookInner() {
  const id = useParams<{ id: string }>().id;
  const router = useRouter();
  const { data: walker } = useQuery({
    queryKey: ["walker", id],
    queryFn: async () => (await apiFetch<{ walker: WalkerProfile }>(api.walker(id))).walker,
  });
  const { data: pets } = usePets();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);

  const offers = walker?.serviceTypes ?? [];
  const serviceOptions = SERVICES.filter((s) => offers.includes(s.value));

  const [serviceType, setServiceType] = useState<ServiceType>("walk");
  // Default to the first service this walker actually offers.
  useEffect(() => {
    if (offers.length > 0 && !offers.includes(serviceType)) {
      setServiceType(offers[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers.join(",")]);
  const [start, setStart] = useState<Date>(earliestStart);
  const [walkMinutes, setWalkMinutes] = useState(60);
  const [daycareDays, setDaycareDays] = useState(1);
  const [boardingNights, setBoardingNights] = useState(1);
  const [dropInMinutes, setDropInMinutes] = useState(30);
  const [petIds, setPetIds] = useState<string[]>([]);
  // Pre-select the customer's dog when they only have one — saves a click and
  // avoids the "Pick at least one dog" stumble in the common single-pet case.
  useEffect(() => {
    if (pets?.length === 1 && petIds.length === 0) setPetIds([pets[0].id]);
  }, [pets, petIds.length]);
  const [isSharedWalk, setIsSharedWalk] = useState(false);
  const [foodDays, setFoodDays] = useState(0);
  const [dropoff, setDropoff] = useState(false);
  const [notes, setNotes] = useState("");

  // Recurrence: "once" creates a single booking; weekly/monthly repeat the same
  // slot for `repeatCount` occurrences, every `repeatInterval` periods.
  const [repeat, setRepeat] = useState<"once" | "weekly" | "monthly">("once");
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatCount, setRepeatCount] = useState(4);
  const isRecurring = repeat !== "once";

  const startTooSoon = start.getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000;

  function continueFromStep1() {
    if (startTooSoon) {
      return toast.error(`Start time must be at least ${MIN_LEAD_MINUTES} minutes from now.`);
    }
    setStep(2);
  }

  const hasWalk = serviceType === "walk";
  // Services hosted at the walker's home can offer food handling + drop-off home.
  const atWalkerHome = serviceType === "daycare" || serviceType === "boarding";
  const selectedPets = (pets ?? []).filter((p) => petIds.includes(p.id));
  const shareEligible = hasWalk && selectedPets.length > 0 && selectedPets.every((p) => p.friendlyWithPets === "friendly");

  // Species rules (mirrored server-side): walks are dogs-only, and every pet
  // must be a species this walker cares for.
  const acceptedSpecies = walker?.acceptedSpecies ?? ["dog"];
  function petBlockReason(p: Pet): string | null {
    if (!acceptedSpecies.includes(p.species)) {
      return p.species === "cat" ? "This walker doesn't care for cats" : "This walker doesn't care for dogs";
    }
    if (p.species === "cat" && hasWalk) return "Walks are dogs-only — pick another service";
    return null;
  }
  // Deselect pets that became incompatible (e.g. after switching Sit → Walk).
  useEffect(() => {
    setPetIds((ids) =>
      ids.filter((pid) => {
        const p = (pets ?? []).find((x) => x.id === pid);
        return p ? petBlockReason(p) === null : false;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType, walker?.acceptedSpecies]);

  function body() {
    return {
      walkerId: id,
      serviceType,
      date: dayISO(start),
      startTime: hhmm(start),
      walkDurationMinutes: hasWalk ? walkMinutes : undefined,
      daycareDays: serviceType === "daycare" ? daycareDays : undefined,
      boardingNights: serviceType === "boarding" ? boardingNights : undefined,
      dropInMinutes: serviceType === "drop_in" ? dropInMinutes : undefined,
      petIds,
      foodDays: serviceType === "boarding" ? foodDays : undefined,
      isSharedWalk: shareEligible ? isSharedWalk : undefined,
      dropoff: atWalkerHome ? dropoff : undefined,
      notes: notes || undefined,
      recurrence: isRecurring
        ? { frequency: repeat, interval: repeatInterval, count: repeatCount }
        : undefined,
    };
  }

  async function goReview() {
    if (petIds.length === 0) return toast.error("Pick at least one pet.");
    setBusy(true);
    try {
      const d = await apiFetch<{ quote: Quote }>(api.bookingQuote, { method: "POST", body: JSON.stringify(body()) });
      setQuote(d.quote);
      setStep(3);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function request() {
    setBusy(true);
    try {
      const d = await apiFetch<{ booking: { id: string }; series?: { count: number } }>(api.bookings, {
        method: "POST",
        body: JSON.stringify(body()),
      });
      toast.success(d.series ? `${d.series.count} bookings requested!` : "Booking requested!");
      router.push(routes.booking(d.booking.id));
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!walker) {
    return (
      <main className="mx-auto max-w-md px-6 py-10">
        <Skeleton className="mb-4 h-4 w-16" />
        <Skeleton className="mb-1 h-7 w-40" />
        <Skeleton className="mb-6 h-4 w-48" />
        <Skeleton className="mb-6 h-1 w-full rounded-full" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <BackButton />
      <h1 className="mb-1 text-2xl font-semibold">Book {walker.firstName}</h1>
      <p className="mb-6 text-sm text-muted-foreground">Pick a date &amp; time that works for you</p>
      <div className="mb-6 h-1 rounded-full bg-muted">
        <div className="h-1 rounded-full bg-primary transition-all" style={{ width: `${(step / TOTAL) * 100}%` }} />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          {/* Service picker — icon cards, one per offered service. */}
          <div>
            <p className="mb-1.5 text-sm font-medium">Service</p>
            <div className="grid grid-cols-2 gap-2">
              {serviceOptions.map(({ value, short, blurb, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setServiceType(value)}
                  aria-pressed={serviceType === value}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                    serviceType === value
                      ? "border-primary bg-accent-subtle/60 shadow-sm"
                      : "border-border bg-surface hover:bg-muted/40"
                  )}
                >
                  <Icon className={cn("h-4 w-4", serviceType === value ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm font-medium">{short}</span>
                  <span className="text-[11px] leading-tight text-muted-foreground">{blurb}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {atWalkerHome ? "Drop-off time" : "Starts"}
            </label>
            <DateTimePicker
              value={start}
              onChange={setStart}
              minDate={earliestStart()}
              ariaLabel="Start date and time"
            />
            <p className={cn("mt-1.5 text-xs", startTooSoon ? "text-primary" : "text-muted-foreground")}>
              {startTooSoon
                ? `Too soon — pick a time at least ${MIN_LEAD_MINUTES} min from now.`
                : "Bookings must start at least 30 minutes from now."}
            </p>
          </div>
          {hasWalk && (
            <PillGroup
              label="Walk duration"
              options={[
                { value: "30", label: "30 min" },
                { value: "60", label: "1 hr" },
                { value: "90", label: "1.5 hr" },
              ]}
              value={String(walkMinutes)}
              onChange={(v) => setWalkMinutes(Number(v))}
            />
          )}
          {serviceType === "drop_in" && (
            <PillGroup
              label="Visit length"
              options={[
                { value: "30", label: "30 min" },
                { value: "60", label: "1 hr" },
              ]}
              value={String(dropInMinutes)}
              onChange={(v) => setDropInMinutes(Number(v))}
            />
          )}
          {serviceType === "daycare" && (
            <div>
              <NumberStepper label="Days of daycare" value={daycareDays} onChange={setDaycareDays} min={1} max={7} />
              <p className="mt-1 text-xs text-muted-foreground">
                Same drop-off time each day · pick-up ~10 hours later.
              </p>
            </div>
          )}
          {serviceType === "boarding" && (
            <div>
              <NumberStepper label="Nights" value={boardingNights} onChange={setBoardingNights} min={1} max={30} />
              <p className="mt-1 text-xs text-muted-foreground">
                Overnights at {walker.firstName}&apos;s home · pick-up{" "}
                {boardingNights === 1 ? "the next day" : `${boardingNights} days later`} around drop-off time.
              </p>
            </div>
          )}

          <PillGroup
            label="Repeat"
            options={[
              { value: "once", label: "One-time" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
            value={repeat}
            onChange={(v) => setRepeat(v as "once" | "weekly" | "monthly")}
          />
          {isRecurring && (
            <div className="space-y-4 rounded-xl bg-muted/40 p-3">
              <NumberStepper
                label={repeat === "weekly" ? "Every (weeks)" : "Every (months)"}
                value={repeatInterval}
                onChange={setRepeatInterval}
                min={1}
                max={4}
              />
              <NumberStepper
                label="Number of bookings"
                value={repeatCount}
                onChange={setRepeatCount}
                min={2}
                max={26}
              />
              <p className="text-xs text-muted-foreground">
                Creates {repeatCount} bookings, one every {repeatInterval}{" "}
                {repeat === "weekly"
                  ? repeatInterval === 1 ? "week" : "weeks"
                  : repeatInterval === 1 ? "month" : "months"}
                . Each is requested separately — {walker.firstName} accepts them one by one.
              </p>
            </div>
          )}

          <Button onClick={continueFromStep1} disabled={startTooSoon} className="w-full">Continue</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Which pet?</p>
            <div className="space-y-2">
              {(pets ?? []).map((p) => {
                const on = petIds.includes(p.id);
                const blocked = petBlockReason(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={blocked !== null}
                    onClick={() => setPetIds((ids) => (on ? ids.filter((x) => x !== p.id) : [...ids, p.id]))}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl bg-surface p-3 text-left transition",
                      on ? "border-2 border-primary" : "border border-border hover:bg-muted/40",
                      blocked !== null && "opacity-50 hover:bg-surface"
                    )}
                  >
                    <span>
                      <span className="block text-sm font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {blocked ?? p.breed ?? (p.species === "cat" ? "Cat" : "Dog")}
                      </span>
                    </span>
                    {on && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
              {(pets ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Add a pet first from “My pets”.</p>
              )}
            </div>
          </div>

          {shareEligible && (
            <div className="flex items-center justify-between rounded-xl bg-trust-subtle p-3">
              <span>
                <span className="block text-sm font-medium text-trust-strong">Share this walk · save 20%</span>
                <span className="block text-xs text-trust-strong">Your friendly dog joins a small group walk</span>
              </span>
              <Switch checked={isSharedWalk} onChange={setIsSharedWalk} ariaLabel="Walk Share" />
            </div>
          )}

          {serviceType === "boarding" && (
            <NumberStepper label="Food handling (days)" value={foodDays} onChange={setFoodDays} min={0} max={30} />
          )}
          {atWalkerHome && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
              <span className="text-sm font-medium">Bring my pet home after</span>
              <Switch checked={dropoff} onChange={setDropoff} ariaLabel="Drop-off" />
            </div>
          )}

          <TextareaField
            label="Notes for the walker (optional)"
            placeholder="Anything they should know — leash habits, treats, allergies…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={goReview} loading={busy} className="flex-1">Review</Button>
          </div>
        </div>
      )}

      {step === 3 && quote && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="space-y-2">
              {quote.lines.map((l, i) => (
                <div key={i} className={cn("flex justify-between text-sm", l.amount < 0 ? "text-trust-strong" : "text-foreground")}>
                  <span>{l.label}</span>
                  <span>{l.amount < 0 ? `−${money(quote.currency, Math.abs(l.amount))}` : money(quote.currency, l.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 text-base font-medium">
                <span>Total</span>
                <span>{money(quote.currency, quote.total)}</span>
              </div>
            </div>
          </div>
          {isRecurring && (
            <p className="rounded-xl bg-trust-subtle p-3 text-center text-xs text-trust-strong">
              This price is per booking. We&apos;ll request {repeatCount} bookings
              ({repeat === "weekly" ? "weekly" : "monthly"}), each billed separately on acceptance.
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            You won&apos;t be charged until {walker.firstName} accepts your request.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={request} loading={busy} className="flex-1">Request booking</Button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function BookPage() {
  return (
    <Protected>
      <BookInner />
    </Protected>
  );
}
