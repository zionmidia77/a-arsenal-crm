import { useState } from "react";
import { motion } from "framer-motion";
import { useAllClients, useUpdateClient } from "@/hooks/useSupabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import KanbanColumn from "@/components/pipeline/KanbanColumn";
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

const AdminPipeline = () => {
  const { data: clients, isLoading } = useAllClients();
  const updateClient = useUpdateClient();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const getClientsForStage = (stage: string) =>
    (clients || []).filter((c) => c.pipeline_stage === stage);

  const onDragEnd = (result: DropResult) => {
    const { draggableId, destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const newStage = destination.droppableId;
    const stageLabel = STAGES.find((s) => s.key === newStage)?.label;

    updateClient.mutate({ id: draggableId, pipeline_stage: newStage as any });
    toast.success(`Movido para ${stageLabel}`);
  };

  const visibleStages = activeFilter
    ? STAGES.filter((s) => s.key === activeFilter)
    : STAGES;

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[300px] w-[260px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const totalLeads = clients?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 space-y-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {totalLeads} clientes no funil · Arraste para mover
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          <Button
            variant={activeFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(null)}
            className="rounded-full shrink-0 text-xs h-8"
          >
            Todos
          </Button>
          {STAGES.map((stage) => {
            const count = getClientsForStage(stage.key).length;
            return (
              <Button
                key={stage.key}
                variant={activeFilter === stage.key ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setActiveFilter(activeFilter === stage.key ? null : stage.key)
                }
                className="rounded-full shrink-0 text-xs gap-1 h-8"
              >
                {stage.emoji} {stage.label}
                {count > 0 && (
                  <span
                    className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                      activeFilter === stage.key
                        ? "bg-primary-foreground/20"
                        : "bg-primary/15 text-primary"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto px-5 pb-24">
          <div className="flex gap-3 min-h-[400px]">
            {visibleStages.map((stage) => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                clients={getClientsForStage(stage.key)}
              />
            ))}
          </div>
        </div>
      </DragDropContext>
    </motion.div>
  );
};

export default AdminPipeline;
