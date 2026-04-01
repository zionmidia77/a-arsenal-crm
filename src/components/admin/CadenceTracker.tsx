import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Clock, SkipForward, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

interface CadenceTrackerProps {
  clientId: string;
}

const actionIcons: Record<string, string> = {
  call: "📞",
  send_message: "💬",
  send_proposal: "📋",
  follow_up: "🔁",
  send_content: "📤",
};

const CadenceTracker = ({ clientId }: CadenceTrackerProps) => {
  const { data: steps, isLoading } = useQuery({
    queryKey: ["cadence-steps", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cadence_steps")
        .select("*, cadence_templates(*)")
        .eq("client_id", clientId)
        .order("step_number", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return null;

  // Get active cadence (not skipped steps for current stage)
  const activeSteps = (steps || []).filter(
    (s: any) => !s.skipped || s.completed_at
  );

  // Group by pipeline_stage, show only the latest cadence
  const latestStage = activeSteps.length > 0 ? activeSteps[activeSteps.length - 1]?.pipeline_stage : null;
  const currentCadence = activeSteps.filter((s: any) => s.pipeline_stage === latestStage);

  if (currentCadence.length === 0) return null;

  const completedCount = currentCadence.filter((s: any) => s.completed_at).length;
  const skippedCount = currentCadence.filter((s: any) => s.skipped).length;
  const totalSteps = currentCadence.length;
  const nextStep = currentCadence.find((s: any) => !s.completed_at && !s.skipped);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Cadência Ativa
        </h3>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{totalSteps - skippedCount} passos
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(completedCount / Math.max(totalSteps - skippedCount, 1)) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Steps timeline */}
      <div className="space-y-1">
        {currentCadence.map((step: any, i: number) => {
          const template = step.cadence_templates;
          const isCompleted = !!step.completed_at;
          const isSkipped = step.skipped;
          const isNext = step.id === nextStep?.id;
          const isPast = new Date(step.scheduled_for) < new Date() && !isCompleted && !isSkipped;

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-2 py-1.5 px-2 rounded-md text-xs transition-colors",
                isCompleted && "text-muted-foreground",
                isSkipped && "text-muted-foreground/50 line-through",
                isNext && "bg-primary/10 text-primary font-medium",
                isPast && !isNext && "bg-destructive/10 text-destructive",
              )}
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : isSkipped ? (
                  <SkipForward className="h-3.5 w-3.5" />
                ) : (
                  <Clock className={cn("h-3.5 w-3.5", isNext ? "text-primary" : isPast ? "text-destructive" : "text-muted-foreground")} />
                )}
              </div>

              {/* Action */}
              <span className="flex-shrink-0">
                {actionIcons[template?.action_type] || "📌"}
              </span>

              {/* Label */}
              <span className="truncate flex-1">
                {template?.task_reason || `Passo ${step.step_number}`}
              </span>

              {/* Date */}
              <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                {isCompleted
                  ? format(new Date(step.completed_at), "dd/MM", { locale: ptBR })
                  : format(new Date(step.scheduled_for), "dd/MM", { locale: ptBR })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Next step highlight */}
      {nextStep && (
        <div className="p-2 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-xs font-medium text-primary">
            ⏭️ Próximo: {nextStep.cadence_templates?.task_reason}
          </p>
          {nextStep.cadence_templates?.suggested_message && (
            <p className="text-[11px] text-muted-foreground mt-1 italic">
              💬 "{nextStep.cadence_templates.suggested_message}"
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CadenceTracker;
