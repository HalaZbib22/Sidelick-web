"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Protected } from "../../components/auth/Protected";
import { Button } from "../../components/ui/Button";
import { Skeleton, ListSkeleton } from "../../components/ui/Skeleton";
import { ProtectedImage } from "../../components/ui/ProtectedImage";
import { DisputeQueue } from "../../components/admin/DisputeQueue";
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

function UserRow({
  u,
  onVerify,
  pending,
}: {
  u: AdminUser;
  onVerify: (id: string, status: "verified" | "rejected") => void;
  pending: boolean;
}) {
  const [showDocs, setShowDocs] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">
            {u.firstName} {u.lastName}
          </p>
          <p className="text-sm text-muted-foreground">{u.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {u.docType ? DOC_LABELS[u.docType] : "No document"} ·{" "}
            {u.hasDoc ? "ID ✓" : "no ID"} · {u.hasSelfie ? "selfie ✓" : "no selfie"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowDocs((s) => !s)}>
            {showDocs ? "Hide" : "Review"}
          </Button>
          <Button variant="outline" onClick={() => onVerify(u.id, "rejected")} disabled={pending}>
            Reject
          </Button>
          <Button onClick={() => onVerify(u.id, "verified")} disabled={pending}>
            Verify
          </Button>
        </div>
      </div>
      {showDocs && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">ID document</p>
            {u.hasDoc ? (
              <ProtectedImage url={api.adminUserFile(u.id, "document")} alt="ID document" className="h-32 w-full rounded-lg border border-border object-cover" />
            ) : (
              <p className="text-xs text-muted-foreground">Not submitted</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Live selfie</p>
            {u.hasSelfie ? (
              <ProtectedImage url={api.adminUserFile(u.id, "selfie")} alt="Live selfie" className="h-32 w-full rounded-lg border border-border object-cover" />
            ) : (
              <p className="text-xs text-muted-foreground">Not submitted</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VerificationsQueue() {
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "pending"],
    queryFn: async () => {
      const d = await apiFetch<{ users: AdminUser[] }>(`${api.adminUsers}?status=pending`);
      return d.users;
    },
  });

  const verify = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "verified" | "rejected" }) =>
      apiFetch(api.adminVerify(id), { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (_d, v) => {
      toast.success(`Walker ${v.status}`);
      qc.invalidateQueries({ queryKey: ["admin", "pending"] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Walkers waiting for ID review. Open “Review” to compare the ID and selfie.
      </p>

      {isLoading ? (
        <ListSkeleton count={3}>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-48" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-16 rounded-lg" />
                <Skeleton className="h-9 w-16 rounded-lg" />
                <Skeleton className="h-9 w-16 rounded-lg" />
              </div>
            </div>
          </div>
        </ListSkeleton>
      ) : !users || users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No walkers pending review.
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <UserRow
              key={u.id}
              u={u}
              onVerify={(id, status) => verify.mutate({ id, status })}
              pending={verify.isPending}
            />
          ))}
        </div>
      )}
    </>
  );
}

type AdminTab = "verifications" | "disputes";

const TABS: { key: AdminTab; label: string }[] = [
  { key: "verifications", label: "Verifications" },
  { key: "disputes", label: "Disputes" },
];

function AdminInner() {
  const [tab, setTab] = useState<AdminTab>("verifications");

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-4 text-2xl font-bold">Admin</h1>

      <div className="mb-6 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition " +
              (tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "verifications" ? <VerificationsQueue /> : <DisputeQueue />}
    </main>
  );
}

export default function AdminPage() {
  return (
    <Protected roles={["admin"]}>
      <AdminInner />
    </Protected>
  );
}
