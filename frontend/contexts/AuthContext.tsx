"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getStoredSession,
  storeSession,
  clearStoredSession,
  SESSION_HINT_KEY,
  type Session,
} from "../lib/auth";
import { apiFetch } from "../lib/api";
import { api } from "../lib/paths";

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  signIn: (user: { id: string; role: Session["role"] }) => void;
  signOut: () => void;
  refreshSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // The hint renders the right chrome instantly; the cookie is the truth.
    const hint = getStoredSession();
    if (hint) {
      setSession(hint);
      setIsLoading(false);
    }

    // Validate against the server (httpOnly cookie rides along automatically).
    let cancelled = false;
    (async () => {
      try {
        const d = await apiFetch<{ user: { id: string; role: Session["role"] } }>(api.me);
        if (cancelled) return;
        const fresh: Session = { userId: d.user.id, role: d.user.role };
        storeSession(fresh);
        setSession(fresh);
      } catch {
        if (cancelled) return;
        clearStoredSession();
        setSession(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    // Cross-tab sync: another tab signed in/out — drop this tab's cached
    // per-user data so it refetches for the new identity.
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_HINT_KEY) {
        setSession(getStoredSession());
        qc.clear();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, [qc]);

  const signIn = (user: { id: string; role: Session["role"] }) => {
    // Wipe the previous user's cached queries (me/pets/bookings/...) so the new
    // session fetches fresh data instead of showing the prior account's role.
    qc.clear();
    const s: Session = { userId: user.id, role: user.role };
    storeSession(s);
    setSession(s);
  };

  const signOut = () => {
    // Server clears the httpOnly cookie; fire-and-forget so signout feels instant.
    void apiFetch(api.logout, { method: "POST" }).catch(() => {});
    clearStoredSession();
    setSession(null);
    qc.clear();
  };

  const refreshSession = () => setSession(getStoredSession());

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
