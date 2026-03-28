import { motion } from "framer-motion";
import { Users, Flame, UserCheck, TrendingUp, ArrowUpRight, ArrowDownRight, BarChart3, Eye } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useDashboardStats, useClients } from "@/hooks/useSupabase";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const chartData = [
  { day: "Seg", leads: 4 }, { day: "Ter", leads: 7 }, { day: "Qua", leads: 5 },
  { day: "Qui", leads: 9 }, { day: "Sex", leads: 12 }, { day: "Sab", leads: 6 }, { day: "Dom", leads: 3 },
];

const tempMap = { hot: "🔥", warm: "🟡", cold: "🔵", frozen: "⚪" };
const tempBg = { hot: "bg-primary/10", warm: "bg-warning/10", cold: "bg-info/10", frozen: "bg-muted" };

const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
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

  const statCards = [
    { label: "Leads novos", value: stats?.totalLeads || 0, icon: Users, color: "text-info", bg: "bg-info/10" },
    { label: "Leads quentes", value: stats?.hotLeads || 0, icon: Flame, color: "text-primary", bg: "bg-primary/10" },
    { label: "Clientes ativos", value: stats?.activeClients || 0, icon: UserCheck, color: "text-success", bg: "bg-success/10" },
    { label: "Oportunidades", value: stats?.opportunities || 0, icon: TrendingUp, color: "text-warning", bg: "bg-warning/10" },
  ];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-6 max-w-4xl">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu negócio</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((s, i) => (
          <motion.div key={i} variants={fadeUp} className="glass-card-hover p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
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

      {/* Chart */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Leads esta semana</span>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={chartData}>
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

      {/* Recent Leads */}
      <motion.div variants={fadeUp}>
        <h2 className="font-display font-semibold mb-3">Leads recentes</h2>
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
                  {tempMap[client.temperature]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{client.name}</p>
                  <p className="text-xs text-muted-foreground">{client.interest || "Sem interesse"} · {formatTimeAgo(client.created_at)}</p>
                </div>
                <Eye className="w-4 h-4 text-muted-foreground" />
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
