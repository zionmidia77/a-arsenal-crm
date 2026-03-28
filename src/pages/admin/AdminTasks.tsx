import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Gift, TrendingUp, Heart, MessageCircle } from "lucide-react";
import { useTasks, useUpdateTask } from "@/hooks/useSupabase";
import { Skeleton } from "@/components/ui/skeleton";

const typeIcon = { opportunity: TrendingUp, relationship: Heart, value: Gift, follow_up: TrendingUp };
const typeColor = { opportunity: "text-primary", relationship: "text-pink-400", value: "text-success", follow_up: "text-info" };
const typeBg = { opportunity: "bg-primary/10", relationship: "bg-pink-400/10", value: "bg-success/10", follow_up: "bg-info/10" };
const typeLabel = { opportunity: "Oportunidade", relationship: "Relacionamento", value: "Valor", follow_up: "Follow-up" };

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const AdminTasks = () => {
  const today = new Date().toISOString().split("T")[0];
  const { data: tasks, isLoading } = useTasks({ due_date: today });
  const updateTask = useUpdateTask();
  const [filter, setFilter] = useState<string>("all");

  const toggleDone = (id: string, currentStatus: string) => {
    updateTask.mutate({
      id,
      status: currentStatus === "done" ? "pending" : "done",
      completed_at: currentStatus === "done" ? null : new Date().toISOString(),
    });
  };

  const allTasks = tasks || [];
  const filtered = filter === "all" ? allTasks : allTasks.filter((t) => t.type === filter);
  const doneCount = allTasks.filter((t) => t.status === "done").length;
  const progress = allTasks.length > 0 ? (doneCount / allTasks.length) * 100 : 0;

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5 max-w-4xl">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-display font-bold">Tarefas de hoje</h1>
        <p className="text-sm text-muted-foreground">
          {allTasks.length > 0
            ? `👉 Hoje você precisa falar com ${allTasks.length - doneCount} pessoas`
            : "Nenhuma tarefa para hoje"
          }
        </p>
      </motion.div>

      {allTasks.length > 0 && (
        <motion.div variants={fadeUp} className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Progresso do dia</span>
            <span className="font-display font-bold text-primary tabular-nums">{doneCount}/{allTasks.length}</span>
          </div>
          <Progress value={progress} className="h-2.5 bg-secondary" />
          {doneCount === allTasks.length && allTasks.length > 0 && (
            <p className="text-xs text-success text-center font-medium">🎉 Todas as tarefas concluídas!</p>
          )}
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto">
        {["all", "opportunity", "relationship", "value", "follow_up"].map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="rounded-full shrink-0 text-xs capitalize">
            {f === "all" ? "Todos" : typeLabel[f as keyof typeof typeLabel] || f}
          </Button>
        ))}
      </motion.div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((task) => {
              const Icon = typeIcon[task.type] || TrendingUp;
              const clientData = task.clients as any;
              const isDone = task.status === "done";
              return (
                <motion.div key={task.id} layout variants={fadeUp} className={`glass-card-hover p-4 flex items-center gap-3 transition-all ${isDone ? "opacity-50" : ""}`}>
                  <Button
                    size="icon"
                    variant={isDone ? "default" : "outline"}
                    className={`rounded-full h-9 w-9 shrink-0 transition-all ${isDone ? "scale-95" : ""}`}
                    onClick={() => toggleDone(task.id, task.status)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>
                      {clientData?.name || "Cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{task.reason}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {clientData?.phone && (
                      <Button size="icon" variant="ghost" className="rounded-full h-8 w-8" onClick={() => window.open(`https://wa.me/55${clientData.phone.replace(/\D/g, "")}`)}>
                        <MessageCircle className="w-3.5 h-3.5 text-success" />
                      </Button>
                    )}
                    <div className={`w-7 h-7 rounded-full ${typeBg[task.type] || "bg-muted"} flex items-center justify-center`}>
                      <Icon className={`w-3.5 h-3.5 ${typeColor[task.type] || "text-muted-foreground"}`} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {allTasks.length === 0 ? "Nenhuma tarefa cadastrada. Leads geram tarefas automaticamente!" : "Nenhuma tarefa neste filtro"}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AdminTasks;
