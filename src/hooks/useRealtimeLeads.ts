import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const NOTIFICATION_SOUND_URL = "https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3";

const playNotificationSound = () => {
  try {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch {}
};

export const useRealtimeLeads = () => {
  const queryClient = useQueryClient();
  const isFirstLoad = useRef(true);

  useEffect(() => {
    // Skip notifications on initial subscribe
    const timer = setTimeout(() => {
      isFirstLoad.current = false;
    }, 3000);

    const channel = supabase
      .channel("realtime-clients")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clients" },
        (payload) => {
          if (isFirstLoad.current) return;

          const newClient = payload.new as any;

          // Invalidate queries so lists refresh
          queryClient.invalidateQueries({ queryKey: ["clients"] });
          queryClient.invalidateQueries({ queryKey: ["clients-all"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

          // Play sound
          playNotificationSound();

          // Show rich toast notification
          toast("🆕 Novo lead chegou!", {
            description: `${newClient.name}${newClient.interest ? ` · ${newClient.interest}` : ""}${newClient.phone ? ` · ${newClient.phone}` : ""}`,
            duration: 8000,
            action: {
              label: "Ver Pipeline",
              onClick: () => {
                window.location.href = "/admin/pipeline";
              },
            },
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clients" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["clients"] });
          queryClient.invalidateQueries({ queryKey: ["clients-all"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
