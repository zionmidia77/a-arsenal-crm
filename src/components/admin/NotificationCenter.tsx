import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Flame, AlertTriangle, MessageCircle, Clock, ChevronRight } from "lucide-react";
import { useOverdueTasks, useClients } from "@/hooks/useSupabase";
import { useNavigate } from "react-router-dom";

const NotificationCenter = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: overdueTasks } = useOverdueTasks();
  const { data: recentClients } = useClients();

  // Get leads from last 24 hours
  const newLeads = (recentClients || []).filter(c => {
    const diff = Date.now() - new Date(c.created_at).getTime();
    return diff < 24 * 60 * 60 * 1000;
  });

  const totalNotifications = (overdueTasks?.length || 0) + newLeads.length;

  const notifications = [
    ...(overdueTasks || []).slice(0, 5).map(t => ({
      id: `task-${t.id}`,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      title: `Follow-up atrasado`,
      desc: (t.clients as any)?.name || "Cliente",
      action: () => { navigate("/admin/tasks"); setOpen(false); },
    })),
    ...newLeads.slice(0, 5).map(c => ({
      id: `lead-${c.id}`,
      icon: Flame,
      color: "text-primary",
      bg: "bg-primary/10",
      title: "Novo lead!",
      desc: `${c.name} · ${c.interest || "sem interesse"}`,
      action: () => { navigate(`/admin/client/${c.id}`); setOpen(false); },
    })),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full relative">
          <Bell className="h-4 w-4" />
          {totalNotifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
              {totalNotifications > 9 ? "9+" : totalNotifications}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="px-4 py-3 border-b border-border/50">
          <p className="text-sm font-display font-semibold">Notificações</p>
          <p className="text-[10px] text-muted-foreground">{totalNotifications} pendentes</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              ✅ Nenhuma notificação
            </div>
          ) : (
            notifications.map(n => (
              <button
                key={n.id}
                onClick={n.action}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
              >
                <div className={`w-8 h-8 rounded-full ${n.bg} flex items-center justify-center shrink-0`}>
                  <n.icon className={`w-3.5 h-3.5 ${n.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{n.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{n.desc}</p>
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
              </button>
            ))
          )}
        </div>
        {totalNotifications > 0 && (
          <div className="px-4 py-2 border-t border-border/50">
            <Button variant="ghost" size="sm" className="w-full text-xs text-primary" onClick={() => { navigate("/admin/tasks"); setOpen(false); }}>
              Ver todas as tarefas
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
