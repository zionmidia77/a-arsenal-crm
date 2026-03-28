import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Gift, TrendingUp, Heart, MessageCircle } from "lucide-react";

const initialTasks = [
  { id: 1, name: "Carlos Silva", phone: "11999887766", reason: "Lead quente - responder", type: "oportunidade" as const, done: false },
  { id: 2, name: "Ana Oliveira", phone: "11988776655", reason: "Aniversário hoje 🎂", type: "relacionamento" as const, done: false },
  { id: 3, name: "Pedro Santos", phone: "11977665544", reason: "Moto valorizada - oferecer troca", type: "valor" as const, done: false },
  { id: 4, name: "Julia Costa", phone: "11966554433", reason: "Follow-up 3 dias", type: "oportunidade" as const, done: false },
  { id: 5, name: "Marcos Lima", phone: "11955443322", reason: "Parcela 12 paga - parabenizar", type: "relacionamento" as const, done: false },
  { id: 6, name: "Fernanda Reis", phone: "11944332211", reason: "Pode melhorar parcela", type: "valor" as const, done: false },
];

const typeIcon = { oportunidade: TrendingUp, relacionamento: Heart, valor: Gift };
const typeColor = { oportunidade: "text-primary", relacionamento: "text-pink-400", valor: "text-success" };
const typeBg = { oportunidade: "bg-primary/10", relacionamento: "bg-pink-400/10", valor: "bg-success/10" };

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const AdminTasks = () => {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<"all" | "oportunidade" | "relacionamento" | "valor">("all");

  const toggleDone = (id: number) => setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.type === filter);
  const doneCount = tasks.filter((t) => t.done).length;
  const progress = (doneCount / tasks.length) * 100;

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5 max-w-4xl">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-display font-bold">Tarefas de hoje</h1>
        <p className="text-sm text-muted-foreground">👉 Hoje você precisa falar com {tasks.length - doneCount} pessoas</p>
      </motion.div>

      {/* Progress */}
      <motion.div variants={fadeUp} className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Progresso do dia</span>
          <span className="font-display font-bold text-primary tabular-nums">{doneCount}/{tasks.length}</span>
        </div>
        <Progress value={progress} className="h-2.5 bg-secondary" />
        {doneCount === tasks.length && (
          <p className="text-xs text-success text-center font-medium">🎉 Parabéns! Todas as tarefas concluídas!</p>
        )}
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto">
        {(["all", "oportunidade", "relacionamento", "valor"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="rounded-full shrink-0 text-xs capitalize">
            {f === "all" ? "Todos" : f}
          </Button>
        ))}
      </motion.div>

      {/* Task List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filtered.map((task) => {
            const Icon = typeIcon[task.type];
            return (
              <motion.div
                key={task.id}
                layout
                variants={fadeUp}
                className={`glass-card-hover p-4 flex items-center gap-3 transition-all ${task.done ? "opacity-50" : ""}`}
              >
                <Button
                  size="icon"
                  variant={task.done ? "default" : "outline"}
                  className={`rounded-full h-9 w-9 shrink-0 transition-all ${task.done ? "scale-95" : ""}`}
                  onClick={() => toggleDone(task.id)}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.done ? "line-through text-muted-foreground" : ""}`}>{task.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{task.reason}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full h-8 w-8"
                    onClick={() => window.open(`https://wa.me/55${task.phone}`)}
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-success" />
                  </Button>
                  <div className={`w-7 h-7 rounded-full ${typeBg[task.type]} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${typeColor[task.type]}`} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AdminTasks;
