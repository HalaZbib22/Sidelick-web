"use client";

import { useRequireAuth, type Role } from "../../hooks/useRequireAuth";
import { LogoLoader } from "../brand/LogoLoader";

interface ProtectedProps {
  children: React.ReactNode;
  roles?: Role[];
}

/**
 * Wrap a page's content to require auth (and optionally a role).
 * Shows the brand loader while resolving / redirecting.
 */
export function Protected({ children, roles }: ProtectedProps) {
  const { isLoading, allowed } = useRequireAuth(roles);

  if (isLoading || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LogoLoader />
      </div>
    );
  }
  return <>{children}</>;
}
