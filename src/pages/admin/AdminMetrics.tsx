import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, Clock, Users, Target, Flame,
  ArrowUpRight, ArrowDownRight
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, FunnelChart, Funnel, LabelList
} from "recharts";
import { useAllClients } from "@/hooks/useSupabase";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";

const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const STAGE_ORDER = ["new", "contacted", "interested", "attending", "thinking", "waiting_response", "scheduled", "negotiating", "closed_won", "closed_lost"];
const STAGE_LABELS: Record<string, string> = {
  new: "Novo", contacted: "Contatado", interested: "Interessado",
  attending: "Atendimento", thinking: "Pensando", waiting_response: "Aguardando",
  scheduled: "Agendado", negotiating: "Negociação", closed_won: "Fechado", closed_lost: "Perdido",
};

const COLORS = [
  "hsl(217 91% 60%)", "hsl(38 92% 50%)", "hsl(0 72% 51%)",
  "hsl(262 83% 58%)", "hsl(142 71% 45%)", "hsl(180 70% 50%)",
  "hsl(330 70% 50%)", "hsl(45 93% 47%)",
];

const AdminMetrics = () => {
  const { data: clients, isLoading } = useAllClients();

  const metrics = useMemo(() => {
    if (!clients) return null;

    // Leads by source
    const sourceMap: Record<string, number> = {};
    clients.forEach(c => {
      const src = c.source || "desconhecido";
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    const bySource = Object.entries(sourceMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Funnel stages
    const stageMap: Record<string, number> = {};
    clients.forEach(c => { stageMap[c.pipeline_stage] = (stageMap[c.pipeline_stage] || 0) + 1; });
    const funnelData = STAGE_ORDER
      .filter(s => s !== "closed_lost")
      .map(s => ({ name: STAGE_LABELS[s] || s, value: stageMap[s] || 0 }));

    // Temperature distribution
    const tempMap: Record<string, number> = { hot: 0, warm: 0, cold: 0, frozen: 0 };
    clients.forEach(c => { tempMap[c.temperature] = (tempMap[c.temperature] || 0) + 1; });
    const tempData = [
      { name: "Quente", value: tempMap.hot, color: "hsl(0 72% 51%)" },
      { name: "Morno", value: tempMap.warm, color: "hsl(38 92% 50%)" },
      { name: "Frio", value: tempMap.cold, color: "hsl(217 91% 60%)" },
      { name: "Inativo", value: tempMap.frozen, color: "hsl(0 0% 50%)" },
    ];

    // Response time
    const withResponse = clients.filter(c => c.response_time_hours != null);
    const avgResponse = withResponse.length > 0
      ? Math.round(withResponse.reduce((a, c) => a + (c.response_time_hours || 0), 0) / withResponse.length)
      : null;

    // Leads per day (last 14 days)
    const dailyMap: Record<string, number> = {};
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = 0;
    }
    clients.forEach(c => {
      const day = c.created_at.split("T")[0];
      if (day in dailyMap) dailyMap[day]++;
    });
    const dailyData = Object.entries(dailyMap).map(([date, count]) => {
      const d = new Date(date + "T12:00:00");
      return { day: `${d.getDate()}/${d.getMonth() + 1}`, leads: count };
    });

    // Conversion
    const total = clients.length;
    const won = stageMap["closed_won"] || 0;
    const lost = stageMap["closed_lost"] || 0;
    const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;
    const lossRate = total > 0 ? Math.round((lost / total) * 100) : 0;

    // Avg lead score
    const avgScore = total > 0 ? Math.round(clients.reduce((a, c) => a + c.lead_score, 0) / total) : 0;

    return { bySource, funnelData, tempData, avgResponse, dailyData, total, won, lost, conversionRate, lossRate, avgScore };
  }, [clients]);

  if (isLoading || !metrics) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    );
  }

  const statCards = [
    { label: "Total de leads", value: metrics.total, icon: Users, color: "text-info", bg: "bg-info/10" },
    { label: "Taxa de conversão", value: `${metrics.conversionRate}%`, icon: Target, color: "text-success", bg: "bg-success/10", sub: `${metrics.won} fechados` },
    { label: "Taxa de perda", value: `${metrics.lossRate}%`, icon: ArrowDownRight, color: "text-destructive", bg: "bg-destructive/10", sub: `${metrics.lost} perdidos` },
    { label: "Score médio", value: metrics.avgScore, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5 max-w-4xl">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-display font-bold">Métricas</h1>
        <p className="text-sm text-muted-foreground">Análise completa do funil e desempenho</p>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((s, i) => (
          <motion.div key={i} variants={fadeUp} className="glass-card p-4">
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-2xl font-display font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            {s.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* Response time */}
      {metrics.avgResponse !== null && (
        <motion.div variants={fadeUp} className="glass-card gradient-border p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tempo médio de resposta</p>
            <p className="text-xl font-display font-bold">{metrics.avgResponse}h</p>
          </div>
        </motion.div>
      )}

      {/* Daily leads chart */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Leads últimos 14 dias</span>
          <span className="text-xs text-muted-foreground ml-auto">
            Total: {metrics.dailyData.reduce((a, b) => a + b.leads, 0)}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={metrics.dailyData}>
            <defs>
              <linearGradient id="lgMetrics" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(0 0% 50%)' }} interval={1} />
            <Tooltip contentStyle={{ background: 'hsl(0 0% 9%)', border: '1px solid hsl(0 0% 15%)', borderRadius: '12px', fontSize: '12px' }} />
            <Area type="monotone" dataKey="leads" stroke="hsl(0 72% 51%)" strokeWidth={2} fill="url(#lgMetrics)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Leads by source */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <p className="text-sm font-medium mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-info" /> Leads por origem
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={metrics.bySource} layout="vertical">
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(0 0% 50%)' }} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(0 0% 70%)' }} width={90} />
            <Tooltip contentStyle={{ background: 'hsl(0 0% 9%)', border: '1px solid hsl(0 0% 15%)', borderRadius: '12px', fontSize: '12px' }} />
            <Bar dataKey="value" fill="hsl(0 72% 51%)" radius={[0, 6, 6, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Temperature distribution */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <p className="text-sm font-medium mb-4 flex items-center gap-2">
          <Flame className="w-4 h-4 text-primary" /> Distribuição por temperatura
        </p>
        <div className="flex items-center gap-6">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie
                data={metrics.tempData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
              >
                {metrics.tempData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {metrics.tempData.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <span className="text-xs flex-1">{t.name}</span>
                <span className="text-xs font-bold tabular-nums">{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Pipeline Funnel */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <p className="text-sm font-medium mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-success" /> Funil de conversão
        </p>
        <div className="space-y-2">
          {metrics.funnelData.map((stage, i) => {
            const maxVal = Math.max(...metrics.funnelData.map(s => s.value), 1);
            const width = Math.max((stage.value / maxVal) * 100, 8);
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-24 text-right shrink-0">{stage.name}</span>
                <div className="flex-1 h-7 bg-secondary/50 rounded-lg overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 0.6, delay: i * 0.08 }}
                    className="h-full rounded-lg flex items-center px-2"
                    style={{ backgroundColor: COLORS[i % COLORS.length] + "40" }}
                  >
                    <span className="text-[10px] font-bold tabular-nums">{stage.value}</span>
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminMetrics;
