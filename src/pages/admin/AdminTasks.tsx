import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Gift, TrendingUp, Heart } from "lucide-react";

const initialTasks = [
  { id: 1, name: "Carlos Silva", reason: "Lead quente - responder", type: "oportunidade" as const, done: false },
  { id: 2, name: "Ana Oliveira", reason: "Aniversário hoje 🎂", type: "relacionamento" as const, done: false },
  { id: 3, name: "Pedro Santos", reason: "Moto valorizada - oferecer troca", type: "valor" as const, done: false },
  { id: 4, name: "Julia Costa", reason: "Follow-up 3 dias", type: "oportunidade" as const, done: false },
  { id: 5, name: "Marcos Lima", reason: "Parcela 12 paga - parabenizar", type: "relacionamento" as const, done: false },
  { id: 6, name: "Fernanda Reis", reason: "Pode melhorar parcela", type: "valor" as const, done: false },
];

const typeIcon = { oportunidade: TrendingUp, relacionamento: Heart, valor: Gift };
const typeColor = { oportunidade: "text-primary", relacionamento: "text-pink-400", valor: "text-green-400" };

const AdminTasks = () => {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<"all" | "oportunidade" | "relacionamento" | "valor">("all");

  const toggleDone = (id: number) => setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.type === filter);
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold">Tarefas de hoje</h1>
        <p className="text-sm text-muted-foreground">👉 Hoje você precisa falar com {tasks.length - doneCount} pessoas</p>
      </div>

      <div className="glass-card p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Progresso do dia</span>
        <span className="font-display font-bold text-primary">{doneCount}/{tasks.length}</span>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {(["all", "oportunidade", "relacionamento", "valor"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="rounded-full shrink-0 text-xs capitalize">
            {f === "all" ? "Todos" : f}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((task, i) => {
          const Icon = typeIcon[task.type];
          return (
            <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`glass-card p-4 flex items-center gap-3 transition-opacity ${task.done ? "opacity-50" : ""}`}>
              <Button
                size="icon"
                variant={task.done ? "default" : "outline"}
                className="rounded-full h-9 w-9 shrink-0"
                onClick={() => toggleDone(task.id)}
              >
                <Check className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.done ? "line-through" : ""}`}>{task.name}</p>
                <p className="text-xs text-muted-foreground truncate">{task.reason}</p>
              </div>
              <Icon className={`w-4 h-4 shrink-0 ${typeColor[task.type]}`} />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminTasks;
