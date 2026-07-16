"use client";

import { useRouter } from "next/navigation";
import { LogOut, Bell, ChevronRight } from "lucide-react";
import { Protected } from "../../components/auth/Protected";
import { Button } from "../../components/ui/Button";
import { BackButton } from "../../components/ui/BackButton";
import { Skeleton, AvatarHeaderSkeleton } from "../../components/ui/Skeleton";
import { useMe } from "../../hooks/useMe";
import { useAuth } from "../../contexts/AuthContext";
import { routes } from "../../lib/paths";

const ROLE_LABEL: Record<string, string> = {
  user: "Pet owner",
  walker: "Walker / Sitter",
  admin: "Admin",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border py-3 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ProfileInner() {
  const { data: me, isLoading } = useMe();
  const { signOut } = useAuth();
  const router = useRouter();

  if (isLoading || !me) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <Skeleton className="mb-4 h-4 w-16" />
        <div className="mb-6">
          <AvatarHeaderSkeleton />
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <BackButton />
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-subtle text-lg font-medium text-link">
          {(me.firstName[0] ?? "") + (me.lastName[0] ?? "")}
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold">
            {me.firstName} {me.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">{ROLE_LABEL[me.role] ?? me.role}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <Row label="Email" value={me.email} />
        {me.phone && <Row label="Phone" value={me.phone} />}
        <Row label="Account type" value={ROLE_LABEL[me.role] ?? me.role} />
        {me.role === "walker" && (
          <Row
            label="Verification"
            value={me.verificationStatus.charAt(0).toUpperCase() + me.verificationStatus.slice(1)}
          />
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <button
          type="button"
          onClick={() => router.push(routes.notificationSettings)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-muted/40"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-link">
            <Bell className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Notifications</span>
            <span className="block text-xs text-muted-foreground">
              Choose what Sidelick can notify you about
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>

      <div className="mt-6">
        <Button
          variant="outline"
          onClick={() => {
            signOut();
            router.replace(routes.home);
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Protected>
      <ProfileInner />
    </Protected>
  );
}
