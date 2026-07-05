"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "../../lib/utils";

export function BackButton({ label = "Back", className }: { label?: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={cn(
        "mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
