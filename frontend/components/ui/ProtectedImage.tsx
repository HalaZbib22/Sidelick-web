"use client";

import { useEffect, useState } from "react";
import { getToken } from "../../lib/auth";
import { cn } from "../../lib/utils";

/**
 * Renders an auth-protected image. The backend serves these behind a Bearer
 * token, which an <img src> can't send — so we fetch the bytes as a blob and
 * hand the <img> an object URL instead.
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
        const token = getToken();
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
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
