"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSession, setToken, clearToken, type Session } from "../lib/auth";

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  signIn: (token: string) => void;
  signOut: () => void;
  refreshSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSession(getSession());
    setIsLoading(false);

    // Cross-tab sync: another tab signed in/out as a different user — drop this
    // tab's cached per-user data so it refetches for the new identity.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "sidelick_token") {
        setSession(getSession());
        qc.clear();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [qc]);

  const signIn = (token: string) => {
    // Wipe the previous user's cached queries (me/pets/bookings/...) so the new
    // session fetches fresh data instead of showing the prior account's role.
    qc.clear();
    setToken(token);
    setSession(getSession());
  };
  const signOut = () => {
    clearToken();
    setSession(null);
    qc.clear();
  };
  const refreshSession = () => setSession(getSession());

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
