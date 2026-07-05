"use client";

import { Loader2 } from "lucide-react";
import { useRequireAuth, type Role } from "../../hooks/useRequireAuth";

interface ProtectedProps {
  children: React.ReactNode;
  roles?: Role[];
}

/**
 * Wrap a page's content to require auth (and optionally a role).
 * Shows a spinner while resolving / redirecting.
 */
export function Protected({ children, roles }: ProtectedProps) {
  const { isLoading, allowed } = useRequireAuth(roles);

  if (isLoading || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <>{children}</>;
}
