"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { routes } from "../lib/paths";
import { Button } from "./ui/Button";

export function SignOutButton() {
  const { signOut } = useAuth();
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={() => {
        signOut();
        router.replace(routes.home);
      }}
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}
