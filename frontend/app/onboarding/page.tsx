"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Protected } from "../../components/auth/Protected";
import { Button } from "../../components/ui/Button";
import { NumberStepper } from "../../components/ui/NumberStepper";
import { PillGroup } from "../../components/ui/PillGroup";
import { UploadField } from "../../components/ui/UploadField";
import { Switch } from "../../components/ui/Switch";
import { TimePicker } from "../../components/ui/TimePicker";
import { CameraCapture } from "../../components/ui/CameraCapture";
import { LeafletMap } from "../../components/map/LeafletMap";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../lib/api";
import { api, routes } from "../../lib/paths";
import { getApiErrorMessage } from "../../lib/forms";
import { cn } from "../../lib/utils";
import type { ServiceType, DocType } from "../../lib/types";

const TOTAL_STEPS = 4;

/* ---------------- Owner: simple welcome ---------------- */
function OwnerOnboarding() {
  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Welcome to Sidelick</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Add your dog so walkers know who they&apos;ll be caring for.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Link href={routes.pets} className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">
          Add my first pet
        </Link>
        <Link href={routes.dashboard} className="text-sm text-muted-foreground hover:text-foreground">
          Skip for now
        </Link>
      </div>
    </main>
  );
}

/* ---------------- Walker: 4-step onboarding ---------------- */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DayAvail {
  weekday: number;
  label: string;
  enabled: boolean;
  start: string;
  end: string;
}

const DOC_OPTIONS: { value: DocType; label: string }[] = [
  { value: "national_id", label: "National ID" },
  { value: "drivers_license", label: "Driver's license" },
  { value: "passport", label: "Passport" },
];

function Stepper({ step }: { step: number }) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-xs text-muted-foreground">Step {step} of {TOTAL_STEPS}</p>
      <div className="h-1 rounded-full bg-muted">
        <div className="h-1 rounded-full bg-primary transition-all" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>
    </div>
  );
}

function ServiceCard({
  title,
  subtitle,
  selected,
  onClick,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-2xl bg-surface p-4 text-left transition",
        selected ? "border-2 border-primary" : "border border-border hover:bg-muted/40"
      )}
    >
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{subtitle}</span>
      </span>
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}

function WalkerOnboarding() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  // Step 1 — services + capacity + location
  const [walk, setWalk] = useState(true);
  const [sit, setSit] = useState(false);
  const [maxPackSize, setMaxPackSize] = useState(4);
  const [maxBoardingPets, setMaxBoardingPets] = useState(3);
  const [lat, setLat] = useState(33.8938);
  const [lng, setLng] = useState(35.5018);

  // Step 2 — availability
  const [avail, setAvail] = useState<DayAvail[]>(
    DAYS.map((label, weekday) => ({ weekday, label, enabled: weekday >= 1 && weekday <= 5, start: "09:00", end: "17:00" }))
  );

  // Step 3 — live selfie ; Step 4 — identity
  const [selfie, setSelfie] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType | "">("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => {
      setLat(p.coords.latitude);
      setLng(p.coords.longitude);
    });
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error("Location isn't available in this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude);
        setLng(p.coords.longitude);
      },
      () => toast.error("Couldn't get your location. Tap the map to set it.")
    );
  }

  const updateDay = (i: number, patch: Partial<DayAvail>) =>
    setAvail((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function saveServices() {
    const serviceTypes: ServiceType[] = [];
    if (walk) serviceTypes.push("walk");
    if (sit) serviceTypes.push("sit");
    if (serviceTypes.length === 0) return toast.error("Choose at least one service.");
    setBusy(true);
    try {
      await apiFetch(api.meWalkerProfile, {
        method: "PATCH",
        body: JSON.stringify({
          serviceTypes,
          maxPackSize: walk ? maxPackSize : undefined,
          maxBoardingPets: sit ? maxBoardingPets : undefined,
          latitude: lat,
          longitude: lng,
        }),
      });
      setStep(2);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveAvailability() {
    const slots = avail
      .filter((d) => d.enabled && d.end > d.start)
      .map((d) => ({ weekday: d.weekday, startTime: d.start, endTime: d.end }));
    if (slots.length === 0) return toast.error("Add availability for at least one day.");
    setBusy(true);
    try {
      await apiFetch(api.meAvailability, { method: "PUT", body: JSON.stringify({ slots }) });
      setStep(3);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitVerification() {
    if (!selfie) return toast.error("Please capture your selfie first.");
    if (!docType) return toast.error("Choose a document type.");
    if (!file) return toast.error("Upload a photo of your ID.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("selfie", selfie);
      fd.append("document", file);
      fd.append("docType", docType);
      await apiFetch(api.meVerification, { method: "POST", body: fd });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Submitted for review!");
      router.push(routes.dashboard);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Set up your walker profile</h1>
      <p className="mb-6 text-sm text-muted-foreground">A few quick steps to get you ready.</p>
      <Stepper step={step} />

      {step === 1 && (
        <div className="space-y-4">
          <p className="font-medium">What do you offer?</p>
          <ServiceCard title="Dog walking" subtitle="Walks at the owner's area" selected={walk} onClick={() => setWalk((v) => !v)} />
          {walk && <NumberStepper label="Max dogs per group walk" value={maxPackSize} onChange={setMaxPackSize} min={1} max={4} />}
          <ServiceCard title="Sitting / boarding" subtitle="Daycare & overnight at your home" selected={sit} onClick={() => setSit((v) => !v)} />
          {sit && <NumberStepper label="Max dogs you can board" value={maxBoardingPets} onChange={setMaxBoardingPets} min={1} max={3} />}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium">Your location</label>
              <button type="button" onClick={useMyLocation} className="text-xs font-medium text-link">Use my location</button>
            </div>
            <LeafletMap center={{ lat, lng }} value={{ lat, lng }} picker height={200} onPick={(la, lo) => { setLat(la); setLng(lo); }} />
            <p className="mt-1 text-xs text-muted-foreground">We auto-detect your spot — tap the map to fine-tune. Owners see your distance, not your address.</p>
          </div>

          <Button onClick={saveServices} loading={busy} className="w-full">Continue</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="font-medium">When are you free?</p>
          {avail.map((d, i) => (
            <div key={d.weekday} className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center gap-3">
                <Switch checked={d.enabled} onChange={(v) => updateDay(i, { enabled: v })} ariaLabel={`Toggle ${d.label}`} />
                <span className="w-9 text-sm font-medium">{d.label}</span>
              </div>
              {d.enabled ? (
                <div className="flex items-center gap-1.5">
                  <TimePicker value={d.start} onChange={(v) => updateDay(i, { start: v })} ariaLabel={`${d.label} start`} />
                  <span className="text-xs text-muted-foreground">–</span>
                  <TimePicker value={d.end} onChange={(v) => updateDay(i, { end: v })} ariaLabel={`${d.label} end`} />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Unavailable</span>
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={saveAvailability} loading={busy} className="flex-1">Continue</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <p className="font-medium">Take a live selfie</p>
            <p className="text-sm text-muted-foreground">
              We&apos;ll match this to your ID in the next step. Look straight at the camera in good light.
            </p>
          </div>
          <CameraCapture onCapture={setSelfie} />
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => setStep(4)} disabled={!selfie} className="flex-1">Continue</Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div>
            <p className="font-medium">Verify your identity</p>
            <p className="text-sm text-muted-foreground">Add an ID so we can match it to your selfie. Required before you can accept bookings.</p>
          </div>
          <PillGroup label="Document type" options={DOC_OPTIONS} value={docType} onChange={setDocType} />
          <UploadField label="Upload a photo of your ID" hint="JPG or PNG, up to 10MB" accept="image/jpeg,image/png,image/webp" onChange={setFile} />
          <p className="text-xs text-muted-foreground">Stored securely and only used to verify you.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
            <Button onClick={submitVerification} loading={busy} className="flex-1">Submit for review</Button>
          </div>
        </div>
      )}
    </main>
  );
}

function OnboardingInner() {
  const { session } = useAuth();
  return session?.role === "walker" ? <WalkerOnboarding /> : <OwnerOnboarding />;
}

export default function OnboardingPage() {
  return (
    <Protected>
      <OnboardingInner />
    </Protected>
  );
}
