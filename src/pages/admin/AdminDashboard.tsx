import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import {
  Users, Flame, AlertTriangle, TrendingUp, CalendarCheck,
  MessageCircle, Eye, ChevronRight, BarChart3, Target, Trophy, Activity
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useDashboardStats, useClients, useOverdueTasks, useAllPendingTasks, useLeadsChartData } from "@/hooks/useSupabase";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import EmptyState from "@/components/EmptyState";
import ActivityFeed from "@/components/admin/ActivityFeed";

const tempEmoji: Record<string, string> = { hot: "🔥", warm: "🟡", cold: "🔵", frozen: "⚪" };
const tempBg: Record<string, string> = { hot: "bg-primary/10", warm: "bg-warning/10", cold: "bg-info/10", frozen: "bg-muted" };

const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

// Animated counter component
const AnimatedCounter = ({ value, duration = 1.2 }: { value: number; duration?: number }) => {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    if (start === end) return;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(step);
      else prevValue.current = end;
    };
    requestAnimationFrame(step);
  }, [value, duration]);

  return <>{display}</>;
};

const formatTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentClients, isLoading: clientsLoading } = useClients();
  const { data: overdueTasks } = useOverdueTasks();
  const { data: pendingTasks } = useAllPendingTasks();
  const { data: chartData } = useLeadsChartData();

  const hotLeads = (recentClients || []).filter(c => c.temperature === "hot").slice(0, 5);
  const todayTasks = (pendingTasks || []).filter(t => t.due_date === new Date().toISOString().split("T")[0]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const statCards = [
    { label: "Leads novos", value: stats?.totalLeads || 0, icon: Users, color: "text-info", bg: "bg-info/10" },
    { label: "Leads quentes", value: stats?.hotLeads || 0, icon: Flame, color: "text-primary", bg: "bg-primary/10" },
    { label: "Follow-ups hoje", value: stats?.todayTasks || 0, icon: CalendarCheck, color: "text-success", bg: "bg-success/10" },
    { label: "Atrasados", value: stats?.overdueTasks || 0, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-6 max-w-4xl">
      {/* Greeting */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-display font-bold">{greeting()}, Arsenal 👊</h1>
        <p className="text-sm text-muted-foreground">
          {(overdueTasks?.length || 0) > 0
            ? `⚠️ Você tem ${overdueTasks?.length} follow-ups atrasados`
            : "Tudo em dia! Continue assim 🔥"
          }
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((s, i) => (
          <motion.div key={i} variants={fadeUp} className="glass-card-hover p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              {s.label === "Atrasados" && (s.value > 0) && (
                <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
              )}
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-display font-bold tabular-nums">{s.value}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Conversion Rate */}
      {stats && stats.totalLeads > 0 && (
        <motion.div variants={fadeUp} className="glass-card gradient-border p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-success" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Taxa de conversão</p>
            <p className="text-xl font-display font-bold">{stats.conversionRate}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Fechados</p>
            <p className="text-sm font-semibold text-success">{stats.closedWon} <span className="text-muted-foreground font-normal">/ {stats.totalLeads}</span></p>
          </div>
        </motion.div>
      )}

      {/* 🔥 DAILY ROUTINE */}
      <motion.div variants={fadeUp} className="glass-card gradient-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-display font-semibold">Hoje você precisa fazer:</p>
            <p className="text-[11px] text-muted-foreground">Foco nas ações que geram resultado</p>
          </div>
        </div>

        {/* Overdue alerts */}
        {(overdueTasks?.length || 0) > 0 && (
          <div className="bg-destructive/10 rounded-xl p-3 border border-destructive/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-xs font-medium text-destructive">Follow-ups atrasados ({overdueTasks?.length})</span>
            </div>
            <div className="space-y-1.5">
              {overdueTasks?.slice(0, 3).map(task => {
                const clientData = task.clients as any;
                return (
                  <div key={task.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-destructive/70">{task.due_date}</span>
                    <span className="text-xs font-medium truncate flex-1">{clientData?.name}</span>
                    {clientData?.phone && (
                      <Button size="sm" className="h-6 ml-auto rounded-full text-[10px] gap-1" onClick={() => window.open(`https://wa.me/55${clientData.phone.replace(/\D/g, "")}`)}>
                        <MessageCircle className="w-2.5 h-2.5" /> Chamar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hot leads to act on */}
        {hotLeads.length > 0 && (
          <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-primary">Leads quentes ({hotLeads.length})</span>
            </div>
            <div className="space-y-1.5">
              {hotLeads.slice(0, 3).map(client => (
                <div key={client.id} className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate flex-1">{client.name}</span>
                  <span className="text-[10px] text-muted-foreground">{client.interest}</span>
                  <Button size="sm" variant="outline" className="h-6 rounded-full text-[10px]" onClick={() => navigate(`/admin/client/${client.id}`)}>
                    <Eye className="w-2.5 h-2.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's follow-ups */}
        {todayTasks.length > 0 && (
          <div className="bg-success/5 rounded-xl p-3 border border-success/20">
            <div className="flex items-center gap-2 mb-2">
              <CalendarCheck className="w-4 h-4 text-success" />
              <span className="text-xs font-medium text-success">Retornos agendados ({todayTasks.length})</span>
            </div>
            <div className="space-y-1.5">
              {todayTasks.slice(0, 3).map(task => {
                const clientData = task.clients as any;
                return (
                  <div key={task.id} className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate flex-1">{clientData?.name}</span>
                    <span className="text-[10px] text-muted-foreground">{task.reason}</span>
                    {clientData?.phone && (
                      <Button size="sm" className="h-6 ml-auto rounded-full text-[10px] gap-1" onClick={() => window.open(`https://wa.me/55${clientData.phone.replace(/\D/g, "")}`)}>
                        <MessageCircle className="w-2.5 h-2.5" /> Chamar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hotLeads.length === 0 && todayTasks.length === 0 && (overdueTasks?.length || 0) === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            ✅ Nada pendente! Aproveite para prospectar novos leads.
          </p>
        )}
      </motion.div>

      {/* Chart - Real Data */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Leads esta semana</span>
          {chartData && (
            <span className="text-xs text-muted-foreground ml-auto">
              Total: {chartData.reduce((a, b) => a + b.leads, 0)}
            </span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={chartData || []}>
            <defs>
              <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(0 0% 50%)' }} />
            <Tooltip contentStyle={{ background: 'hsl(0 0% 9%)', border: '1px solid hsl(0 0% 15%)', borderRadius: '12px', fontSize: '12px' }} />
            <Area type="monotone" dataKey="leads" stroke="hsl(0 72% 51%)" strokeWidth={2} fill="url(#leadGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Activity Feed */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Atividades recentes</span>
        </div>
        <ActivityFeed />
      </motion.div>

      {/* Recent Leads */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold">Leads recentes</h2>
          <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => navigate("/admin/leads")}>
            Ver todos <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        {clientsLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : recentClients && recentClients.length > 0 ? (
          <div className="space-y-2">
            {recentClients.slice(0, 5).map((client) => (
              <motion.div
                key={client.id}
                variants={fadeUp}
                className="glass-card-hover px-4 py-3 flex items-center gap-3 cursor-pointer"
                onClick={() => navigate(`/admin/client/${client.id}`)}
              >
                <div className={`w-9 h-9 rounded-full ${tempBg[client.temperature]} flex items-center justify-center text-xs font-bold shrink-0`}>
                  {tempEmoji[client.temperature]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{client.name}</p>
                  <p className="text-xs text-muted-foreground">{client.interest || "Sem interesse"} · {formatTimeAgo(client.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">{client.lead_score}pts</span>
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="Nenhum lead ainda"
            description="Compartilhe o funil de captura para começar a receber leads automaticamente!"
            actionLabel="Copiar link do funil"
            onAction={() => {
              navigator.clipboard.writeText(`${window.location.origin}/chat`);
              import("sonner").then(({ toast }) => toast.success("Link copiado!"));
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );
};

export default AdminDashboard;
