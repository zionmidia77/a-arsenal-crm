import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Copy, Check, Search, Eye, SortAsc, SortDesc } from "lucide-react";
import { useClients } from "@/hooks/useSupabase";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";

const tempStyles: Record<string, string> = {
  hot: "border-l-primary bg-primary/5",
  warm: "border-l-warning bg-warning/5",
  cold: "border-l-info bg-info/5",
  frozen: "border-l-muted bg-muted/5",
};
const tempBadge: Record<string, string> = {
  hot: "bg-primary/15 text-primary",
  warm: "bg-warning/15 text-warning",
  cold: "bg-info/15 text-info",
  frozen: "bg-muted/15 text-muted-foreground",
};
const tempLabel: Record<string, string> = { hot: "Quente", warm: "Morno", cold: "Frio", frozen: "Inativo" };

const STAGE_LABELS: Record<string, string> = {
  new: "🆕 Novo", contacted: "📞 Contatado", interested: "🔥 Interessado",
  attending: "🤝 Em atendimento", thinking: "🤔 Pensando", waiting_response: "⏳ Aguardando",
  scheduled: "📅 Agendado", negotiating: "💰 Negociação", closed_won: "🏆 Fechado", closed_lost: "❌ Perdido",
};

const sourceBadge: Record<string, string> = {
  funnel: "bg-info/15 text-info",
  whatsapp: "bg-success/15 text-success",
  facebook: "bg-blue-500/15 text-blue-400",
  manual: "bg-muted/15 text-muted-foreground",
};

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

type SortField = "created_at" | "lead_score" | "name";

const AdminLeads = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "hot" | "warm" | "cold">("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const navigate = useNavigate();

  const { data: clients, isLoading } = useClients(
    filter !== "all" ? { temperature: filter } : undefined
  );

  const copyMsg = (client: Tables<"clients">) => {
    const firstName = client.name.split(" ")[0];
    navigator.clipboard.writeText(
      `Fala ${firstName}! Aqui é da Arsenal Motors 🏍️ Vi que você tem interesse em ${(client.interest || "motos").toLowerCase()}. Posso te ajudar?`
    );
    setCopiedId(client.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const filtered = (clients || [])
    .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search) || l.interest?.toLowerCase().includes(search.toLowerCase()))
    .filter(l => stageFilter === "all" || l.pipeline_stage === stageFilter)
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "lead_score") cmp = a.lead_score - b.lead_score;
      else if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortAsc ? cmp : -cmp;
    });

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5 max-w-4xl">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-display font-bold">Leads</h1>
        <p className="text-sm text-muted-foreground">{clients?.length || 0} leads capturados</p>
      </motion.div>

      <motion.div variants={fadeUp} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, telefone ou interesse..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl bg-secondary border-border/50 h-10" />
      </motion.div>

      {/* Temperature filter */}
      <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto">
        {(["all", "hot", "warm", "cold"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="rounded-full shrink-0 text-xs">
            {f === "all" ? "Todos" : f === "hot" ? "🔥 Quentes" : f === "warm" ? "🟡 Mornos" : "🔵 Frios"}
          </Button>
        ))}
      </motion.div>

      {/* Stage filter */}
      <motion.div variants={fadeUp} className="flex gap-1.5 overflow-x-auto pb-1">
        <Button variant={stageFilter === "all" ? "default" : "ghost"} size="sm" onClick={() => setStageFilter("all")} className="rounded-full shrink-0 text-[10px] h-7">
          Todas etapas
        </Button>
        {Object.entries(STAGE_LABELS).map(([key, label]) => (
          <Button key={key} variant={stageFilter === key ? "default" : "ghost"} size="sm" onClick={() => setStageFilter(stageFilter === key ? "all" : key)} className="rounded-full shrink-0 text-[10px] h-7">
            {label}
          </Button>
        ))}
      </motion.div>

      {/* Sort buttons */}
      <motion.div variants={fadeUp} className="flex gap-2">
        {([["created_at", "Data"], ["lead_score", "Score"], ["name", "Nome"]] as [SortField, string][]).map(([field, label]) => (
          <Button key={field} variant="ghost" size="sm" className={`rounded-full text-[10px] h-7 gap-1 ${sortField === field ? "text-primary" : ""}`} onClick={() => toggleSort(field)}>
            {sortField === field ? (sortAsc ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />) : null}
            {label}
          </Button>
        ))}
        <span className="text-[10px] text-muted-foreground ml-auto self-center">{filtered.length} resultados</span>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((client) => (
            <motion.div key={client.id} variants={fadeUp} className={`glass-card-hover p-4 border-l-4 ${tempStyles[client.temperature]}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${tempBadge[client.temperature]}`}>
                    {client.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{client.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{client.interest || "Sem interesse definido"}</p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tempBadge[client.temperature]}`}>
                    {tempLabel[client.temperature]}
                  </span>
                  <p className="text-[10px] text-muted-foreground">{new Date(client.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${sourceBadge[client.source || "funnel"]}`}>
                  {client.source || "funnel"}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {STAGE_LABELS[client.pipeline_stage] || client.pipeline_stage}
                </span>
                <span className="text-[9px] text-muted-foreground font-mono ml-auto">{client.lead_score}pts</span>
              </div>

              <div className="flex gap-2">
                {client.phone && (
                  <Button size="sm" className="rounded-full text-xs gap-1.5 flex-1 h-9" onClick={() => window.open(`https://wa.me/55${client.phone?.replace(/\D/g, "")}`)}>
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </Button>
                )}
                <Button size="sm" variant="outline" className="rounded-full text-xs gap-1.5 h-9" onClick={() => navigate(`/admin/client/${client.id}`)}>
                  <Eye className="w-3.5 h-3.5" /> Ver
                </Button>
                <Button size="sm" variant="outline" className="rounded-full text-xs gap-1.5 h-9" onClick={() => copyMsg(client)}>
                  {copiedId === client.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedId === client.id ? "!" : "Msg"}
                </Button>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum lead encontrado</div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AdminLeads;
