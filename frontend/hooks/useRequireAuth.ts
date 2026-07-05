"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { routes } from "../lib/paths";
import type { Session } from "../lib/auth";

export type Role = Session["role"];

/**
 * Client-side route guard.
 * - Not signed in        → redirect to /signin
 * - Signed in, wrong role → redirect to /unauthorized
 *
 * NOTE: this is UX enforcement only. The backend is the real security boundary
 * (it returns 401/403). We guard client-side because the JWT lives in
 * localStorage and isn't visible to Next.js edge middleware.
 */
export function useRequireAuth(roles?: Role[]) {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace(routes.signin);
      return;
    }
    if (roles && !roles.includes(session.role)) {
      router.replace(routes.unauthorized);
    }
  }, [session, isLoading, roles, router]);

  const allowed = !!session && (!roles || roles.includes(session.role));
  return { session, isLoading, allowed };
}
