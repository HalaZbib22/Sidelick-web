"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ClipboardList,
  Flag,
  LayoutDashboard,
  MessageSquareQuote,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Protected } from "../../components/auth/Protected";
import { OverviewPanel } from "../../components/admin/OverviewPanel";
import { VerificationQueue } from "../../components/admin/VerificationQueue";
import { PaymentQueue } from "../../components/admin/PaymentQueue";
import { DisputeQueue } from "../../components/admin/DisputeQueue";
import { PetReportQueue } from "../../components/admin/PetReportQueue";
import { DebriefLog } from "../../components/admin/DebriefLog";
import { ReviewsLog } from "../../components/admin/ReviewsLog";
import { apiFetch } from "../../lib/api";
import { api } from "../../lib/paths";

type AdminTab =
  | "overview"
  | "verifications"
  | "payments"
  | "disputes"
  | "petReports"
  | "reviews"
  | "debriefs";

const SECTIONS: { key: AdminTab; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "verifications", label: "Verifications", icon: ShieldCheck },
  { key: "payments", label: "Payments", icon: Wallet },
  { key: "disputes", label: "Disputes", icon: AlertTriangle },
  { key: "petReports", label: "Pet reports", icon: Flag },
  { key: "reviews", label: "Reviews", icon: MessageSquareQuote },
  { key: "debriefs", label: "Debriefs", icon: ClipboardList },
];

const TITLES: Record<AdminTab, { title: string; sub: string }> = {
  overview: { title: "Overview", sub: "The pulse of the platform" },
  verifications: { title: "Verifications", sub: "Compare ID and selfie, then decide" },
  payments: { title: "Payments", sub: "Manual-rail confirmations and settlements" },
  disputes: { title: "Disputes", sub: "Customer-raised booking issues" },
  petReports: { title: "Pet reports", sub: "Walker-flagged profile inaccuracies" },
  reviews: { title: "Reviews", sub: "What customers are saying" },
  debriefs: { title: "Debriefs", sub: "Walker post-service insights" },
};

function AdminInner() {
  const [tab, setTab] = useState<AdminTab>("overview");

  // Shared with OverviewPanel via the query cache; powers the sidebar badges.
  const { data: overview } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () =>
      (
        await apiFetch<{
          overview: { queues: Record<string, number> };
        }>(api.adminOverview)
      ).overview,
    refetchInterval: 60_000,
  });

  const badge = (key: AdminTab): number => {
    const q = overview?.queues;
    if (!q) return 0;
    switch (key) {
      case "verifications":
        return q.pendingVerifications ?? 0;
      case "payments":
        return (q.pendingPayments ?? 0) + (q.pendingSettlements ?? 0);
      case "disputes":
        return q.openDisputes ?? 0;
      case "petReports":
        return q.openPetReports ?? 0;
      default:
        return 0;
    }
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row">
      {/* Sidebar (top scroller on mobile) */}
      <nav
        aria-label="Admin sections"
        className="flex shrink-0 gap-1 overflow-x-auto md:w-52 md:flex-col md:overflow-visible"
      >
        <p className="mb-2 hidden px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:block">
          Admin portal
        </p>
        {SECTIONS.map(({ key, label, icon: Icon }) => {
          const count = badge(key);
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
              {count > 0 && (
                <span
                  className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                    active ? "bg-white/20" : "bg-primary/10 text-primary"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <section className="min-w-0 flex-1">
        <header className="mb-5">
          <h1 className="font-display text-3xl font-semibold">{TITLES[tab].title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{TITLES[tab].sub}</p>
        </header>

        {tab === "overview" ? (
          <OverviewPanel goTo={(t) => setTab(t as AdminTab)} />
        ) : tab === "verifications" ? (
          <VerificationQueue />
        ) : tab === "payments" ? (
          <PaymentQueue />
        ) : tab === "disputes" ? (
          <DisputeQueue />
        ) : tab === "petReports" ? (
          <PetReportQueue />
        ) : tab === "reviews" ? (
          <ReviewsLog />
        ) : (
          <DebriefLog />
        )}
      </section>
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
