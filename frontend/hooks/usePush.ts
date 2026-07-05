"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  pushSupported,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "../lib/push";

type PushStatus = "unsupported" | "default" | "granted" | "denied";

/**
 * Drives the "enable closed-app notifications" toggle. Reflects browser support,
 * the current permission, and whether this device is subscribed on our server.
 */
export function usePush() {
  const [status, setStatus] = useState<PushStatus>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Initial read: support + permission + existing subscription.
  useEffect(() => {
    if (!pushSupported()) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as PushStatus);
    void getExistingSubscription().then((s) => setSubscribed(!!s));
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const ok = await subscribeToPush();
      if (ok) {
        setSubscribed(true);
        setStatus("granted");
        toast.success("Notifications enabled", {
          description: "We'll alert you even when the app is closed.",
        });
      } else {
        setStatus(Notification.permission as PushStatus);
        toast.error("Notifications blocked", {
          description: "Allow notifications in your browser settings to enable this.",
        });
      }
    } catch {
      toast.error("Couldn't enable notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
      toast("Closed-app notifications turned off");
    } catch {
      toast.error("Couldn't turn off notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    supported: status !== "unsupported",
    denied: status === "denied",
    subscribed,
    busy,
    enable,
    disable,
  };
}
