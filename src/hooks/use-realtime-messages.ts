"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { trpc } from "@/lib/trpc/client";

export function useRealtimeMessages(userId: string | undefined) {
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`messages:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          void utils.messaging.listThreads.invalidate();
          void utils.messaging.getThread.invalidate();
          void utils.messaging.unreadCount.invalidate();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${userId}`,
        },
        () => {
          void utils.messaging.listThreads.invalidate();
          void utils.messaging.getThread.invalidate();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, utils]);
}
