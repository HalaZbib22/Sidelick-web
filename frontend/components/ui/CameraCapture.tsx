"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, VideoOff } from "lucide-react";
import { Button } from "./Button";

interface CameraCaptureProps {
  /** Receives the captured photo as a File, or null when retaken/cleared. */
  onCapture: (file: File | null) => void;
  /** Camera to use: "user" (front, default — selfies) or "environment" (rear — pets). */
  facing?: "user" | "environment";
  /** Mirror the preview + saved image. Defaults to true for the front camera. */
  mirror?: boolean;
  /** Button label while live. Defaults to "Capture selfie". */
  captureLabel?: string;
  /** Alt/aria text for the captured shot. Defaults to "Your selfie". */
  shotAlt?: string;
}

/**
 * Live selfie capture via getUserMedia.
 *
 * A single effect owns the camera lifecycle: it runs while the feed is live
 * (no captured shot) and its cleanup stops every track — so the camera turns
 * off the instant you capture, retake, or leave the step. A per-run `active`
 * flag prevents React Strict Mode's double-mount from leaking a stream.
 */
export function CameraCapture({
  onCapture,
  facing = "user",
  mirror,
  captureLabel = "Capture selfie",
  shotAlt = "Your selfie",
}: CameraCaptureProps) {
  const mirrored = mirror ?? facing === "user";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (shot) return; // showing the captured photo — no live camera needed
    let active = true;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (active) setError("We couldn't access your camera. Please allow camera access and try again.");
      }
    })();
    return () => {
      active = false;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [shot, attempt, facing]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (mirrored) {
      // Mirror so the saved photo matches the mirrored live preview.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setShot(canvas.toDataURL("image/jpeg", 0.9)); // flips `shot` → effect cleanup stops the camera
    canvas.toBlob((b) => b && onCapture(new File([b], "photo.jpg", { type: "image/jpeg" })), "image/jpeg", 0.9);
  }

  function retake() {
    onCapture(null);
    setError(null);
    setShot(null); // re-runs the effect → camera comes back on
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-muted">
        <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`} />
        {shot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt={shotAlt} className="absolute inset-0 h-full w-full object-cover" />
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface p-6 text-center">
            <VideoOff className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => setAttempt((a) => a + 1)}>Try again</Button>
          </div>
        )}
      </div>
      {shot ? (
        <Button variant="outline" className="w-full" onClick={retake}>
          <RotateCcw className="h-4 w-4" />
          Retake
        </Button>
      ) : (
        <Button className="w-full" onClick={capture} disabled={!!error}>
          <Camera className="h-4 w-4" />
          {captureLabel}
        </Button>
      )}
    </div>
  );
}
