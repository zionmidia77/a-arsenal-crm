import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageCircle, Copy, Check, Search, Eye, SortAsc, SortDesc, Filter, CalendarIcon, X, GitMerge, CheckSquare } from "lucide-react";
import { useClients, useTags } from "@/hooks/useSupabase";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import MergeLeadsDialog from "@/components/admin/MergeLeadsDialog";

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

const sourceLabel: Record<string, string> = {
  funnel: "Funil", whatsapp: "WhatsApp", facebook: "Facebook", manual: "Manual",
};

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

type SortField = "created_at" | "lead_score" | "name";

const AdminLeads = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "hot" | "warm" | "cold">("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const navigate = useNavigate();

  const { data: clients, isLoading } = useClients(
    filter !== "all" ? { temperature: filter } : undefined
  );

  const { data: tags } = useTags();

  // Fetch tag assignments for filtering
  const { data: tagAssignments } = useQuery({
    queryKey: ["all-tag-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_tag_assignments").select("client_id, tag_id");
      if (error) throw error;
      return data;
    },
  });

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

  const clearFilters = () => {
    setFilter("all");
    setStageFilter("all");
    setSourceFilter("all");
    setTagFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearch("");
  };

  const hasActiveFilters = filter !== "all" || stageFilter !== "all" || sourceFilter !== "all" || tagFilter !== "all" || dateFrom || dateTo;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const selectedLeads = (clients || []).filter((c) => selectedIds.has(c.id));

  const clientIdsWithTag = tagFilter !== "all" && tagAssignments
    ? tagAssignments.filter(a => a.tag_id === tagFilter).map(a => a.client_id)
    : null;

  const filtered = (clients || [])
    .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search) || l.interest?.toLowerCase().includes(search.toLowerCase()))
    .filter(l => stageFilter === "all" || l.pipeline_stage === stageFilter)
    .filter(l => sourceFilter === "all" || l.source === sourceFilter)
    .filter(l => !clientIdsWithTag || clientIdsWithTag.includes(l.id))
    .filter(l => {
      if (!dateFrom && !dateTo) return true;
      const created = new Date(l.created_at);
      if (dateFrom && created < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59);
        if (created > end) return false;
      }
      return true;
    })
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
        <Button
          variant={showAdvanced ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="rounded-full shrink-0 text-xs gap-1 ml-auto"
        >
          <Filter className="w-3 h-3" />
          Filtros
          {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
        </Button>
      </motion.div>

      {/* Advanced filters */}
      {showAdvanced && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="glass-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Filtros avançados</p>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-6 text-destructive">
                <X className="w-3 h-3 mr-1" /> Limpar
              </Button>
            )}
          </div>

          {/* Source filter */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-1.5">Fonte</p>
            <div className="flex gap-1.5 flex-wrap">
              {["all", "funnel", "whatsapp", "facebook", "manual"].map(s => (
                <Button key={s} variant={sourceFilter === s ? "default" : "outline"} size="sm"
                  onClick={() => setSourceFilter(s)} className="rounded-full text-[10px] h-7">
                  {s === "all" ? "Todas" : sourceLabel[s] || s}
                </Button>
              ))}
            </div>
          </div>

          {/* Tag filter */}
          {tags && tags.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">Tags</p>
              <div className="flex gap-1.5 flex-wrap">
                <Button variant={tagFilter === "all" ? "default" : "outline"} size="sm"
                  onClick={() => setTagFilter("all")} className="rounded-full text-[10px] h-7">
                  Todas
                </Button>
                {tags.map(tag => (
                  <Button key={tag.id} variant={tagFilter === tag.id ? "default" : "outline"} size="sm"
                    onClick={() => setTagFilter(tagFilter === tag.id ? "all" : tag.id)}
                    className="rounded-full text-[10px] h-7 gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Date range */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-1.5">Período</p>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("rounded-full text-[10px] h-7 gap-1", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="w-3 h-3" />
                    {dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("rounded-full text-[10px] h-7 gap-1", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="w-3 h-3" />
                    {dateTo ? format(dateTo, "dd/MM/yy") : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </motion.div>
      )}

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
