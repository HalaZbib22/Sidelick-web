"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { api, socketUrl } from "../lib/paths";
import { useAuth } from "../contexts/AuthContext";
import type { AppNotification } from "../lib/types";

interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

const KEY = ["notifications"] as const;

/**
 * Notifications data + a live Socket.IO connection.
 *
 * React Query holds the persisted list (history + unread count); the socket
 * pushes new notifications in real time, which we splice into the same cache
 * so the bell updates instantly without a refetch. One socket per mounted hook
 * — mount this once (in AppNav).
 */
export function useNotifications() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  const query = useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<NotificationsResponse>(api.notifications),
    enabled: !!session,
    staleTime: 30_000,
  });

  // Live channel: connect with the JWT, prepend incoming notifications.
  useEffect(() => {
    if (!session) return;
    const socket = io(socketUrl, {
      auth: { token: session.token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("notification", (n: AppNotification) => {
      qc.setQueryData<NotificationsResponse>(KEY, (prev) => {
        const existing = prev?.notifications ?? [];
        // Guard against an accidental duplicate id.
        if (existing.some((x) => x.id === n.id)) return prev;
        return {
          notifications: [n, ...existing].slice(0, 50),
          unreadCount: (prev?.unreadCount ?? 0) + 1,
        };
      });
      toast(n.title, { description: n.body ?? undefined });
    });

    return () => {
      socket.off("notification");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session, qc]);

  const markAll = useMutation({
    mutationFn: () => apiFetch(api.notificationsReadAll, { method: "POST" }),
    onSuccess: () => {
      qc.setQueryData<NotificationsResponse>(KEY, (prev) =>
        prev
          ? { notifications: prev.notifications.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })), unreadCount: 0 }
          : prev
      );
    },
  });

  const markOne = useMutation({
    mutationFn: (id: string) => apiFetch(api.notificationRead(id), { method: "POST" }),
    onSuccess: (_d, id) => {
      qc.setQueryData<NotificationsResponse>(KEY, (prev) => {
        if (!prev) return prev;
        const wasUnread = prev.notifications.some((n) => n.id === id && !n.readAt);
        return {
          notifications: prev.notifications.map((n) =>
            n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n
          ),
          unreadCount: Math.max(0, prev.unreadCount - (wasUnread ? 1 : 0)),
        };
      });
    },
  });

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    markAllRead: () => markAll.mutate(),
    markRead: (id: string) => markOne.mutate(id),
  };
}
