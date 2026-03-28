import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAllClients, useUpdateClient } from "@/hooks/useSupabase";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MessageCircle, Eye, Phone, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const STAGES = [
  { key: "new", label: "Novo", emoji: "🆕", color: "border-t-blue-500" },
  { key: "contacted", label: "Contatado", emoji: "📞", color: "border-t-yellow-500" },
  { key: "interested", label: "Interessado", emoji: "🔥", color: "border-t-orange-500" },
  { key: "attending", label: "Em atendimento", emoji: "🤝", color: "border-t-purple-500" },
  { key: "thinking", label: "Pensando", emoji: "🤔", color: "border-t-amber-500" },
  { key: "waiting_response", label: "Aguardando", emoji: "⏳", color: "border-t-cyan-500" },
  { key: "scheduled", label: "Agendado", emoji: "📅", color: "border-t-indigo-500" },
  { key: "negotiating", label: "Negociação", emoji: "💰", color: "border-t-emerald-500" },
  { key: "closed_won", label: "Fechado ✅", emoji: "🏆", color: "border-t-green-500" },
  { key: "closed_lost", label: "Perdido", emoji: "❌", color: "border-t-red-500" },
];

const tempBadge: Record<string, string> = {
  hot: "bg-primary/15 text-primary",
  warm: "bg-warning/15 text-warning",
  cold: "bg-info/15 text-info",
  frozen: "bg-muted/15 text-muted-foreground",
};
const tempEmoji: Record<string, string> = { hot: "🔥", warm: "🟡", cold: "🔵", frozen: "⚪" };

const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const ClientCard = ({ client, onMove }: { client: Tables<"clients">; onMove: (id: string, stage: string) => void }) => {
  const navigate = useNavigate();
  const currentIdx = STAGES.findIndex(s => s.key === client.pipeline_stage);

  return (
    <motion.div
      layout
      variants={fadeUp}
      initial="initial"
      animate="animate"
      className="glass-card p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tempBadge[client.temperature]}`}>
          {tempEmoji[client.temperature]}
        </span>
        <span className="text-sm font-medium truncate flex-1">{client.name}</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{client.lead_score}pts</span>
      </div>

      {client.interest && (
        <p className="text-[11px] text-muted-foreground truncate">{client.interest}</p>
      )}

      {/* Quick actions */}
      <div className="flex gap-1.5">
        {client.phone && (
          <Button
            size="sm"
            className="h-7 rounded-full text-[10px] gap-1 flex-1"
            onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/55${client.phone?.replace(/\D/g, "")}`); }}
          >
            <MessageCircle className="w-3 h-3" /> WhatsApp
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7 rounded-full text-[10px] gap-1"
          onClick={() => navigate(`/admin/client/${client.id}`)}
        >
          <Eye className="w-3 h-3" />
        </Button>
      </div>

      {/* Move stage */}
      <div className="flex gap-1">
        {currentIdx > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] flex-1 gap-0.5 text-muted-foreground"
            onClick={() => onMove(client.id, STAGES[currentIdx - 1].key)}
          >
            <ChevronLeft className="w-3 h-3" /> {STAGES[currentIdx - 1].label}
          </Button>
        )}
        {currentIdx < STAGES.length - 1 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] flex-1 gap-0.5 text-muted-foreground"
            onClick={() => onMove(client.id, STAGES[currentIdx + 1].key)}
          >
            {STAGES[currentIdx + 1].label} <ChevronRight className="w-3 h-3" />
          </Button>
        )}
      </div>
    </motion.div>
  );
};

const AdminPipeline = () => {
  const { data: clients, isLoading } = useAllClients();
  const updateClient = useUpdateClient();
  const [activeStage, setActiveStage] = useState("new");

  const moveClient = (id: string, stage: string) => {
    updateClient.mutate({ id, pipeline_stage: stage as any });
    toast.success(`Movido para ${STAGES.find(s => s.key === stage)?.label}`);
  };

  const getClientsForStage = (stage: string) =>
    (clients || []).filter(c => c.pipeline_stage === stage);

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-24 rounded-full" />)}</div>
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 md:p-6 space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Pipeline</h1>
        <p className="text-sm text-muted-foreground">{clients?.length || 0} clientes no funil</p>
      </div>

      {/* Stage tabs - horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {STAGES.map(stage => {
          const count = getClientsForStage(stage.key).length;
          return (
            <Button
              key={stage.key}
              variant={activeStage === stage.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveStage(stage.key)}
              className="rounded-full shrink-0 text-xs gap-1.5 h-9"
            >
              {stage.emoji} {stage.label}
              {count > 0 && (
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeStage === stage.key ? "bg-primary-foreground/20" : "bg-primary/15 text-primary"
                }`}>
                  {count}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {/* Desktop: Multi-column kanban */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-3">
        {STAGES.slice(0, 8).map(stage => {
          const stageClients = getClientsForStage(stage.key);
          return (
            <div key={stage.key} className={`glass-card p-3 border-t-2 ${stage.color} space-y-2 min-h-[200px]`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{stage.emoji} {stage.label}</span>
                <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">{stageClients.length}</span>
              </div>
              <AnimatePresence>
                {stageClients.map(client => (
                  <ClientCard key={client.id} client={client} onMove={moveClient} />
                ))}
              </AnimatePresence>
              {stageClients.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-6">Nenhum cliente</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: Single column with active stage */}
      <div className="lg:hidden space-y-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            {getClientsForStage(activeStage).length > 0 ? (
              getClientsForStage(activeStage).map(client => (
                <ClientCard key={client.id} client={client} onMove={moveClient} />
              ))
            ) : (
              <div className="glass-card p-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhum cliente nesta etapa</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AdminPipeline;
