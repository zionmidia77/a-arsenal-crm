import { motion } from "framer-motion";
import { Cake, PhoneCall, ArrowUpCircle, Sparkles, ChevronRight, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const useLTVStats = () =>
  useQuery({
    queryKey: ["ltv-dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      // Birthdays this month
      const { data: birthdays } = await supabase
        .from("clients")
        .select("id, name, birthdate, phone")
        .not("birthdate", "is", null)
        .neq("status", "lost");

      const birthdaysThisMonth = (birthdays || []).filter((c) => {
        if (!c.birthdate) return false;
        const d = new Date(c.birthdate + "T12:00:00");
        return d.getMonth() + 1 === month;
      });

      const birthdaysToday = birthdaysThisMonth.filter((c) => {
        const d = new Date(c.birthdate! + "T12:00:00");
        return d.getDate() === day;
      });

      // Pending check-in tasks
      const { data: checkinTasks } = await supabase
        .from("tasks")
        .select("id, client_id, reason, due_date, clients(name, phone)")
        .eq("type", "relationship")
        .eq("status", "pending")
        .ilike("reason", "%check-in%")
        .order("due_date", { ascending: true })
        .limit(10);

      // Pending upgrade opportunities
      const { data: upgrades } = await supabase
        .from("opportunities")
        .select("id, client_id, title, message, clients(name, phone)")
        .eq("type", "trade")
        .eq("status", "pending")
        .order("priority", { ascending: false })
        .limit(10);

      // Pending birthday opportunities
      const { data: bdayOpps } = await supabase
        .from("opportunities")
        .select("id")
        .eq("type", "birthday")
        .eq("status", "pending");

      // NPS trend - last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data: npsData } = await supabase
        .from("nps_responses")
        .select("score, created_at")
        .gte("created_at", sixMonthsAgo.toISOString())
        .order("created_at", { ascending: true });

      // Group NPS by month
      const npsMonthly: Record<string, { total: number; count: number }> = {};
      (npsData || []).forEach((r) => {
        const d = new Date(r.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!npsMonthly[key]) npsMonthly[key] = { total: 0, count: 0 };
        npsMonthly[key].total += r.score;
        npsMonthly[key].count += 1;
      });

      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const npsTrend = Object.entries(npsMonthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => {
          const [, m] = key.split("-");
          return {
            month: monthNames[parseInt(m) - 1],
            avg: Math.round((val.total / val.count) * 10) / 10,
            count: val.count,
          };
        });

      // Overall NPS average
      const allScores = (npsData || []).map((r) => r.score);
      const npsAvg = allScores.length > 0 ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : null;

      return {
        birthdaysToday,
        birthdaysThisMonth,
        checkinTasks: checkinTasks || [],
        upgrades: upgrades || [],
        pendingBdayOpps: bdayOpps?.length || 0,
        npsTrend,
        npsAvg,
        npsTotal: allScores.length,
      };
    },
  });

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

const LTVDashboard = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useLTVStats();

  if (isLoading) {
    return (
      <div className="glass-card p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: "Aniversários",
      sublabel: "este mês",
      value: data.birthdaysThisMonth.length,
      highlight: data.birthdaysToday.length,
      highlightLabel: "hoje",
      icon: Cake,
      color: "text-pink-400",
      bg: "bg-pink-400/10",
      border: "border-pink-400/20",
    },
    {
      label: "Check-ins",
      sublabel: "pendentes",
      value: data.checkinTasks.length,
      icon: PhoneCall,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      border: "border-cyan-400/20",
    },
    {
      label: "Upgrades",
      sublabel: "oportunidades",
      value: data.upgrades.length,
      icon: ArrowUpCircle,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      border: "border-amber-400/20",
    },
  ];

  const hasItems =
    data.birthdaysToday.length > 0 ||
    data.checkinTasks.length > 0 ||
    data.upgrades.length > 0;

  return (
    <motion.div variants={fadeUp} className="glass-card gradient-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <div>
          <p className="text-sm font-display font-semibold">Automações LTV</p>
          <p className="text-[11px] text-muted-foreground">Relacionamento & retenção de clientes</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.97 }}
            className={`rounded-xl p-3 border ${card.border} ${card.bg} cursor-pointer relative overflow-hidden`}
          >
            <card.icon className={`w-4 h-4 ${card.color} mb-2`} />
            <p className="text-2xl font-display font-bold tabular-nums">{card.value}</p>
            <p className="text-[10px] text-muted-foreground">{card.label}</p>
            <p className="text-[9px] text-muted-foreground">{card.sublabel}</p>
            {card.highlight != null && card.highlight > 0 && (
              <motion.span
                className="absolute top-2 right-2 text-[9px] font-bold bg-pink-500 text-white px-1.5 py-0.5 rounded-full"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {card.highlight} {card.highlightLabel}
              </motion.span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Today's birthday alerts */}
      {data.birthdaysToday.length > 0 && (
        <div className="bg-pink-400/5 rounded-xl p-3 border border-pink-400/20">
          <div className="flex items-center gap-2 mb-2">
            <Cake className="w-4 h-4 text-pink-400" />
            <span className="text-xs font-medium text-pink-400">
              🎂 Aniversariantes hoje ({data.birthdaysToday.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {data.birthdaysToday.map((client) => (
              <div key={client.id} className="flex items-center gap-2">
                <span className="text-xs font-medium truncate flex-1">{client.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 rounded-full text-[10px] gap-1 border-pink-400/30 text-pink-400"
                  onClick={() => navigate(`/admin/client/${client.id}`)}
                >
                  Ver <ChevronRight className="w-2.5 h-2.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending check-ins */}
      {data.checkinTasks.length > 0 && (
        <div className="bg-cyan-400/5 rounded-xl p-3 border border-cyan-400/20">
          <div className="flex items-center gap-2 mb-2">
            <PhoneCall className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-medium text-cyan-400">
              Check-ins pendentes ({data.checkinTasks.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {data.checkinTasks.slice(0, 3).map((task) => {
              const client = task.clients as any;
              return (
                <div key={task.id} className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate flex-1">{client?.name}</span>
                  <span className="text-[10px] text-muted-foreground">{task.due_date}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 rounded-full text-[10px] gap-1 border-cyan-400/30 text-cyan-400"
                    onClick={() => navigate(`/admin/client/${(task as any).client_id}`)}
                  >
                    Ver
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending upgrades */}
      {data.upgrades.length > 0 && (
        <div className="bg-amber-400/5 rounded-xl p-3 border border-amber-400/20">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">
              Oportunidades de upgrade ({data.upgrades.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {data.upgrades.slice(0, 3).map((opp) => {
              const client = opp.clients as any;
              return (
                <div key={opp.id} className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate flex-1">{client?.name}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{opp.title}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 rounded-full text-[10px] gap-1 border-amber-400/30 text-amber-400"
                    onClick={() => navigate(`/admin/client/${opp.client_id}`)}
                  >
                    Ver
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!hasItems && (
        <p className="text-xs text-muted-foreground text-center py-3">
          ✅ Nenhuma automação LTV pendente. Tudo em dia!
        </p>
      )}
    </motion.div>
  );
};

export default LTVDashboard;
