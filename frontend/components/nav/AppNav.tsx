"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useMe } from "../../hooks/useMe";
import { routes } from "../../lib/paths";
import { ThemeToggle } from "../ui/ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { cn } from "../../lib/utils";

const HIDDEN = new Set(["/", "/signin", "/signup", "/forgot-password", "/reset-password"]);

export function AppNav() {
  const pathname = usePathname();
  const { session, signOut } = useAuth();
  const router = useRouter();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);

  if (!session || HIDDEN.has(pathname)) return null;

  const role = session.role;
  const links =
    role === "walker"
      ? [{ href: routes.bookings, label: "Bookings" }]
      : role === "admin"
        ? [{ href: routes.admin, label: "Admin" }]
        : [
            { href: routes.walkers, label: "Find walkers" },
            { href: routes.pets, label: "My pets" },
            { href: routes.bookings, label: "Bookings" },
          ];

  const initials =
    `${me?.firstName?.[0] ?? ""}${me?.lastName?.[0] ?? ""}`.toUpperCase() || "U";

  const signOutAndHome = () => {
    setOpen(false);
    signOut();
    router.replace(routes.home);
  };

  const linkClass = (href: string) =>
    cn(
      "rounded-lg px-3 py-1.5 text-sm font-medium transition",
      pathname.startsWith(href) ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href={routes.dashboard} className="text-lg font-medium text-primary">
          Sidelick
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={open}
              className="flex h-9 items-center gap-1 rounded-full border border-border py-0.5 pl-0.5 pr-2 transition hover:bg-muted"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-subtle text-xs font-medium text-link">
                {initials}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {open && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-border bg-surface p-1 shadow-lg">
                  {/* Mobile: surface the nav links here too */}
                  <div className="sm:hidden">
                    {links.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-lg px-3 py-2 text-sm hover:bg-muted"
                      >
                        {l.label}
                      </Link>
                    ))}
                    <div className="my-1 border-t border-border" />
                  </div>
                  <Link
                    href={routes.profile}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
                  >
                    <User className="h-4 w-4" /> Profile &amp; settings
                  </Link>
                  <button
                    type="button"
                    onClick={signOutAndHome}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-muted"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
