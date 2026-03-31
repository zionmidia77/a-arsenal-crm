import { useState, useEffect, useMemo } from "react";
import { LayoutList, LayoutGrid } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAllClients, useUpdateClient } from "@/hooks/useSupabase";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanColumnSkeleton } from "@/components/admin/SkeletonLoaders";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import KanbanColumn from "@/components/pipeline/KanbanColumn";
import type { Tables } from "@/integrations/supabase/types";
import PageTour from "@/components/admin/PageTour";
import { Kanban, Filter, LayoutList as LayoutListIcon, MousePointer } from "lucide-react";

const STAGES = [
  { key: "new", label: "Novo Lead", emoji: "🆕", color: "border-t-blue-500" },
  { key: "first_contact", label: "1º Contato", emoji: "📞", color: "border-t-yellow-500" },
  { key: "qualification", label: "Qualificação", emoji: "🔍", color: "border-t-orange-500" },
  { key: "proposal", label: "Proposta", emoji: "📋", color: "border-t-purple-500" },
  { key: "negotiation", label: "Negociação", emoji: "💰", color: "border-t-emerald-500" },
  { key: "closing", label: "Fechamento", emoji: "📝", color: "border-t-indigo-500" },
  { key: "closed_won", label: "Fechado ✅", emoji: "🏆", color: "border-t-green-500" },
  { key: "closed_lost", label: "Perdido", emoji: "❌", color: "border-t-red-500" },
];

const AdminPipeline = () => {
  const { data: clients, isLoading } = useAllClients();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const updateClient = useUpdateClient();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [compactMode, setCompactMode] = useState(false);

  // Fetch chat conversations to show badges on cards
  const { data: chatConvos = [] } = useQuery({
    queryKey: ["pipeline-chat-convos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("client_id, status")
        .not("client_id", "is", null);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Fetch interaction counts per client
  const { data: interactionCounts = [] } = useQuery({
    queryKey: ["pipeline-interaction-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interactions")
        .select("client_id");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Build lookup maps
  const chatDataByClient = useMemo(() => {
    const map: Record<string, { count: number; hasActive: boolean }> = {};
    for (const c of chatConvos) {
      if (!c.client_id) continue;
      if (!map[c.client_id]) map[c.client_id] = { count: 0, hasActive: false };
      map[c.client_id].count++;
      if (c.status === "active" || c.status === "transferred") {
        map[c.client_id].hasActive = true;
      }
    }
    return map;
  }, [chatConvos]);

  const interactionsByClient = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of interactionCounts) {
      map[i.client_id] = (map[i.client_id] || 0) + 1;
    }
    return map;
  }, [interactionCounts]);

  // Auto-filter to the highlighted client's stage
  useEffect(() => {
    if (highlightId && clients) {
      const c = clients.find(cl => cl.id === highlightId);
      if (c) {
        setActiveFilter(c.pipeline_stage);
        setTimeout(() => {
          const el = document.getElementById(`kanban-card-${highlightId}`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }
    }
  }, [highlightId, clients]);

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
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <KanbanColumnSkeleton key={i} />
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
      <div className="px-4 md:px-5 pt-4 md:pt-5 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              {totalLeads} clientes no funil · Arraste para mover
            </p>
          </div>
          <div className="flex rounded-full border border-border/50 overflow-hidden">
            <button
              onClick={() => setCompactMode(false)}
              className={`p-2 transition-colors ${!compactMode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              title="Cards expandidos"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCompactMode(true)}
              className={`p-2 transition-colors ${compactMode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              title="Cards compactos"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          <Button
            variant={activeFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(null)}
            className="rounded-full shrink-0 text-xs min-h-[40px] md:min-h-[32px] h-auto px-4 md:px-3"
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
                className="rounded-full shrink-0 text-xs gap-1 min-h-[40px] md:min-h-[32px] h-auto px-4 md:px-3"
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
        <div className="flex-1 overflow-x-auto px-4 md:px-5 pb-24">
          {/* Mobile: vertical stack when single stage filtered, horizontal scroll otherwise */}
          <div className={`flex gap-3 min-h-[400px] ${
            activeFilter ? "flex-col md:flex-row" : ""
          }`}>
            {visibleStages.map((stage) => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                clients={getClientsForStage(stage.key)}
                highlightId={highlightId}
                chatDataByClient={chatDataByClient}
                interactionsByClient={interactionsByClient}
                compact={compactMode}
              />
            ))}
          </div>
        </div>
      </DragDropContext>
    </motion.div>
  );
};

export default AdminPipeline;
