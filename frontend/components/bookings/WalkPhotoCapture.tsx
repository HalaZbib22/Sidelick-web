"use client";

import { useState } from "react";
import { CameraCapture } from "../ui/CameraCapture";
import { Button } from "../ui/Button";

/**
 * Inline rear-camera capture used at each walk checkpoint. The walker takes a
 * photo of the pet, then confirms — the photo is required before the action
 * (start / halfway / finish) is sent.
 */
export function WalkPhotoCapture({
  title,
  hint,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  title: string;
  hint: string;
  submitLabel: string;
  pending: boolean;
  onSubmit: (file: File) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{hint}</p>
      <CameraCapture
        facing="environment"
        captureLabel="Take photo"
        shotAlt="Photo of the pet"
        onCapture={setFile}
      />
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!file}
          loading={pending}
          onClick={() => file && onSubmit(file)}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
