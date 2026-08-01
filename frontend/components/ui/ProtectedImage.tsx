"use client";

import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

/**
 * Renders an auth-protected image. The backend serves these behind the
 * httpOnly session cookie; we fetch the bytes with credentials and hand the
 * <img> an object URL.
 */
export function ProtectedImage({
  url,
  alt,
  className,
}: {
  url: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    setSrc(null);
    setFailed(false);
    (async () => {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (failed)
    return (
      <div className={cn("flex items-center justify-center bg-muted text-xs text-muted-foreground", className)}>
        Couldn&apos;t load image
      </div>
    );
  if (!src) return <div className={cn("animate-pulse bg-muted", className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}
