import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Search, MessageSquare } from "lucide-react";
import { useMessageTemplates } from "@/hooks/useSupabase";
import { Skeleton } from "@/components/ui/skeleton";

const categoryBadge: Record<string, string> = {
  lead: "bg-info/15 text-info",
  relacionamento: "bg-pink-400/15 text-pink-400",
  oportunidade: "bg-warning/15 text-warning",
};

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const AdminMessages = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: templates, isLoading } = useMessageTemplates(filter);

  const copy = (id: string, msg: string) => {
    navigator.clipboard.writeText(msg);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = (templates || []).filter(
    (t) => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.message.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5 max-w-4xl">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-display font-bold">Mensagens</h1>
        <p className="text-sm text-muted-foreground">Biblioteca de mensagens prontas</p>
      </motion.div>

      <motion.div variants={fadeUp} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar mensagem..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl bg-secondary border-border/50 h-10" />
      </motion.div>

      <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto">
        {["all", "lead", "relacionamento", "oportunidade"].map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="rounded-full shrink-0 text-xs capitalize">
            {f === "all" ? "Todas" : f}
          </Button>
        ))}
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <motion.div key={t.id} variants={fadeUp} className="glass-card-hover p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">{t.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{t.title}</p>
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full capitalize ${categoryBadge[t.category] || 'bg-muted/15 text-muted-foreground'}`}>
                  {t.category}
                </span>
              </div>
              <div className="bg-secondary/50 rounded-xl p-3 mb-3">
                <p className="text-sm text-muted-foreground leading-relaxed">{t.message}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-full text-xs gap-1.5 flex-1 h-9" onClick={() => copy(t.id, t.message)}>
                  {copiedId === t.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedId === t.id ? "Copiado!" : "Copiar mensagem"}
                </Button>
                <Button size="sm" className="rounded-full text-xs gap-1.5 h-9">
                  <MessageSquare className="w-3.5 h-3.5" /> Enviar
                </Button>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma mensagem encontrada</div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AdminMessages;
