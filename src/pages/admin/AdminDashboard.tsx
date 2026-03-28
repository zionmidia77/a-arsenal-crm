import { motion } from "framer-motion";
import { Users, Flame, UserCheck, TrendingUp, ArrowUpRight, ArrowDownRight, BarChart3 } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";

const stats = [
  { label: "Leads novos", value: "24", icon: Users, color: "text-info", bg: "bg-info/10", change: "+12%", up: true },
  { label: "Leads quentes", value: "8", icon: Flame, color: "text-primary", bg: "bg-primary/10", change: "+5%", up: true },
  { label: "Clientes ativos", value: "142", icon: UserCheck, color: "text-success", bg: "bg-success/10", change: "+3%", up: true },
  { label: "Oportunidades", value: "15", icon: TrendingUp, color: "text-warning", bg: "bg-warning/10", change: "-2%", up: false },
];

const chartData = [
  { day: "Seg", leads: 4 }, { day: "Ter", leads: 7 }, { day: "Qua", leads: 5 },
  { day: "Qui", leads: 9 }, { day: "Sex", leads: 12 }, { day: "Sab", leads: 6 }, { day: "Dom", leads: 3 },
];

const recentLeads = [
  { name: "Carlos Silva", interest: "Comprar", temp: "hot" as const, time: "2 min", avatar: "CS" },
  { name: "Ana Oliveira", interest: "Trocar", temp: "warm" as const, time: "15 min", avatar: "AO" },
  { name: "Pedro Santos", interest: "Vender", temp: "cold" as const, time: "1h", avatar: "PS" },
  { name: "Julia Costa", interest: "Comprar", temp: "hot" as const, time: "2h", avatar: "JC" },
];

const tempMap = { hot: "🔥", warm: "🟡", cold: "🔵" };
const tempBg = { hot: "bg-primary/10", warm: "bg-warning/10", cold: "bg-info/10" };

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

const AdminDashboard = () => (
  <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-6 max-w-4xl">
    <motion.div variants={fadeUp}>
      <h1 className="text-2xl font-display font-bold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Visão geral do seu negócio</p>
    </motion.div>

    {/* Stats */}
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s, i) => (
        <motion.div key={i} variants={fadeUp} className="glass-card-hover p-4">
          <div className="flex items-center justify-between mb-3">
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <span className={`text-[10px] font-medium flex items-center gap-0.5 ${s.up ? 'text-success' : 'text-destructive'}`}>
              {s.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {s.change}
            </span>
          </div>
          <p className="text-2xl font-display font-bold tabular-nums">{s.value}</p>
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
          <Tooltip
            contentStyle={{ background: 'hsl(0 0% 9%)', border: '1px solid hsl(0 0% 15%)', borderRadius: '12px', fontSize: '12px' }}
            labelStyle={{ color: 'hsl(0 0% 50%)' }}
          />
          <Area type="monotone" dataKey="leads" stroke="hsl(0 72% 51%)" strokeWidth={2} fill="url(#leadGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>

    {/* Recent Leads */}
    <motion.div variants={fadeUp}>
      <h2 className="font-display font-semibold mb-3">Leads recentes</h2>
      <div className="space-y-2">
        {recentLeads.map((lead, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            className="glass-card-hover px-4 py-3 flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-full ${tempBg[lead.temp]} flex items-center justify-center text-xs font-bold shrink-0`}>
              {tempMap[lead.temp]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{lead.name}</p>
              <p className="text-xs text-muted-foreground">{lead.interest} · {lead.time} atrás</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  </motion.div>
);

export default AdminDashboard;
