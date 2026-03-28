import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Copy, Check, Search, Phone, Eye } from "lucide-react";
import { useClients } from "@/hooks/useSupabase";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";

const tempStyles = {
  hot: "border-l-primary bg-primary/5",
  warm: "border-l-warning bg-warning/5",
  cold: "border-l-info bg-info/5",
  frozen: "border-l-muted bg-muted/5",
};
const tempBadge = {
  hot: "bg-primary/15 text-primary",
  warm: "bg-warning/15 text-warning",
  cold: "bg-info/15 text-info",
  frozen: "bg-muted/15 text-muted-foreground",
};
const tempLabel = { hot: "Quente", warm: "Morno", cold: "Frio", frozen: "Inativo" };

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const AdminLeads = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "hot" | "warm" | "cold">("all");
  const [search, setSearch] = useState("");
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

  const filtered = (clients || []).filter(
    (l) => !search || l.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5 max-w-4xl">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-display font-bold">Leads</h1>
        <p className="text-sm text-muted-foreground">{clients?.length || 0} leads capturados</p>
      </motion.div>

      <motion.div variants={fadeUp} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar lead..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl bg-secondary border-border/50 h-10" />
      </motion.div>

      <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto">
        {(["all", "hot", "warm", "cold"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="rounded-full shrink-0 text-xs">
            {f === "all" ? "Todos" : f === "hot" ? "🔥 Quentes" : f === "warm" ? "🟡 Mornos" : "🔵 Frios"}
          </Button>
        ))}
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
                <div className="text-right">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tempBadge[client.temperature]}`}>
                    {tempLabel[client.temperature]}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(client.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
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
