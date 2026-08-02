"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "../ui/Button";
import { ListSkeleton, Skeleton } from "../ui/Skeleton";
import { ProtectedImage } from "../ui/ProtectedImage";
import { apiFetch } from "../../lib/api";
import { api } from "../../lib/paths";
import { getApiErrorMessage } from "../../lib/forms";

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  verificationStatus: string;
  docType: string | null;
  hasDoc: boolean;
  hasSelfie: boolean;
}

const DOC_LABELS: Record<string, string> = {
  national_id: "National ID",
  drivers_license: "Driver's license",
  passport: "Passport",
};

const CHECKLIST = [
  "The selfie face matches the ID photo",
  "The document is legible and looks unaltered",
  "The name on the document matches the account",
] as const;

/**
 * The manual-verification workroom: one applicant at a time, ID document and
 * live selfie side by side, and an explicit checklist that gates the Verify
 * button — eyeballing becomes a consistent process.
 */
export function VerificationQueue() {
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "pending"],
    queryFn: async () =>
      (await apiFetch<{ users: AdminUser[] }>(`${api.adminUsers}?status=pending`)).users,
  });

  const verify = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "verified" | "rejected" }) =>
      apiFetch(api.adminVerify(id), { method: "POST", body: JSON.stringify({ status }) }),
    onSuccess: (_d, v) => {
      toast.success(v.status === "verified" ? "Walker verified ✔" : "Application rejected");
      qc.invalidateQueries({ queryKey: ["admin", "pending"] });
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  if (isLoading) {
    return (
      <ListSkeleton count={2}>
        <Skeleton className="h-40 rounded-2xl" />
      </ListSkeleton>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-trust-subtle">
          <ShieldCheck className="h-5 w-5 text-trust-strong" />
        </span>
        <p className="font-display mt-3 text-lg font-semibold">All caught up</p>
        <p className="mt-1 text-sm text-muted-foreground">No walkers waiting for verification.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {users.map((u) => (
        <ApplicantCard key={u.id} user={u} verify={verify} />
      ))}
    </div>
  );
}

function ApplicantCard({
  user: u,
  verify,
}: {
  user: AdminUser;
  verify: {
    mutate: (v: { id: string; status: "verified" | "rejected" }) => void;
    isPending: boolean;
  };
}) {
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const allChecked = checked.every(Boolean);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold">
            {u.firstName} {u.lastName}
          </p>
          <p className="text-sm text-muted-foreground">
            {u.email} · {u.docType ? DOC_LABELS[u.docType] : "No document type"}
          </p>
        </div>
        <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
          Pending review
        </span>
      </div>

      {/* Side-by-side compare — the core of the manual check. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <figure>
          <figcaption className="mb-1.5 text-xs font-medium text-muted-foreground">
            ID document
          </figcaption>
          {u.hasDoc ? (
            <ProtectedImage
              url={api.adminUserFile(u.id, "document")}
              alt={`${u.firstName}'s ID document`}
              className="aspect-[4/3] w-full rounded-xl border border-border object-contain bg-muted"
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Not submitted
            </p>
          )}
        </figure>
        <figure>
          <figcaption className="mb-1.5 text-xs font-medium text-muted-foreground">
            Live selfie
          </figcaption>
          {u.hasSelfie ? (
            <ProtectedImage
              url={api.adminUserFile(u.id, "selfie")}
              alt={`${u.firstName}'s live selfie`}
              className="aspect-[4/3] w-full rounded-xl border border-border object-contain bg-muted"
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Not submitted
            </p>
          )}
        </figure>
      </div>

      {/* The checklist gates Verify — no accidental approvals. */}
      <div className="mt-4 space-y-2">
        {CHECKLIST.map((item, i) => (
          <button
            key={item}
            type="button"
            onClick={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
            aria-pressed={checked[i]}
            className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-background/50 p-2.5 text-left text-sm transition-colors hover:bg-muted/40"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                checked[i]
                  ? "border-trust bg-trust text-trust-foreground"
                  : "border-border bg-surface"
              }`}
            >
              {checked[i] && <Check className="h-3.5 w-3.5" />}
            </span>
            {item}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          onClick={() => verify.mutate({ id: u.id, status: "verified" })}
          disabled={!allChecked || verify.isPending}
          className="flex-1"
        >
          <ShieldCheck className="h-4 w-4" />
          {allChecked ? "Verify walker" : "Complete the checklist to verify"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (window.confirm(`Reject ${u.firstName}'s application? They'll be asked to resubmit.`)) {
              verify.mutate({ id: u.id, status: "rejected" });
            }
          }}
          disabled={verify.isPending}
        >
          <X className="h-4 w-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}
