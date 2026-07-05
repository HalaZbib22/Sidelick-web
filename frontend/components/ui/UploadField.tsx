"use client";

import { useId, useState } from "react";
import { UploadCloud, CheckCircle2 } from "lucide-react";

interface UploadFieldProps {
  label: string;
  hint?: string;
  accept?: string;
  capture?: "user" | "environment";
  onChange: (file: File | null) => void;
}

/** Styled dashed dropzone wrapping a hidden file input. */
export function UploadField({ label, hint, accept, capture, onChange }: UploadFieldProps) {
  const id = useId();
  const [name, setName] = useState<string | null>(null);

  return (
    <div>
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-accent/50 bg-surface p-6 text-center transition hover:bg-muted/40"
      >
        {name ? (
          <CheckCircle2 className="h-6 w-6 text-trust" />
        ) : (
          <UploadCloud className="h-6 w-6 text-primary" />
        )}
        <span className="mt-2 text-sm font-medium text-primary">{name ?? label}</span>
        {hint && !name && <span className="mt-1 text-xs text-muted-foreground">{hint}</span>}
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        {...(capture ? { capture } : {})}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setName(f?.name ?? null);
          onChange(f);
        }}
      />
    </div>
  );
}
