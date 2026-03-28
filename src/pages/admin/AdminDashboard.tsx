import { motion } from "framer-motion";
import { Users, Flame, UserCheck, TrendingUp } from "lucide-react";

const stats = [
  { label: "Leads novos", value: "24", icon: Users, color: "text-blue-400" },
  { label: "Leads quentes", value: "8", icon: Flame, color: "text-primary" },
  { label: "Clientes ativos", value: "142", icon: UserCheck, color: "text-green-400" },
  { label: "Oportunidades", value: "15", icon: TrendingUp, color: "text-yellow-400" },
];

const recentLeads = [
  { name: "Carlos Silva", interest: "Comprar", temp: "hot" as const, time: "2 min" },
  { name: "Ana Oliveira", interest: "Trocar", temp: "warm" as const, time: "15 min" },
  { name: "Pedro Santos", interest: "Vender", temp: "cold" as const, time: "1h" },
  { name: "Julia Costa", interest: "Comprar", temp: "hot" as const, time: "2h" },
];

const tempMap = { hot: "🔥", warm: "🟡", cold: "🔵" };
const tempLabel = { hot: "Quente", warm: "Morno", cold: "Frio" };

const AdminDashboard = () => (
  <div className="p-5 space-y-6">
    <div>
      <h1 className="text-2xl font-display font-bold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Visão geral do seu negócio</p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {stats.map((s, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="glass-card p-4">
          <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
          <p className="text-2xl font-display font-bold">{s.value}</p>
          <p className="text-xs text-muted-foreground">{s.label}</p>
        </motion.div>
      ))}
    </div>

    <div>
      <h2 className="font-display font-semibold mb-3">Leads recentes</h2>
      <div className="space-y-2">
        {recentLeads.map((lead, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }} className="glass-card px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg">{tempMap[lead.temp]}</span>
              <div>
                <p className="text-sm font-medium">{lead.name}</p>
                <p className="text-xs text-muted-foreground">{lead.interest} · {lead.time} atrás</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{tempLabel[lead.temp]}</span>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

export default AdminDashboard;
