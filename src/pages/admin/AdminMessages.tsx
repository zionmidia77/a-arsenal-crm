import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Check, Search, MessageSquare, MessageCircle, Users, Send } from "lucide-react";
import { useMessageTemplates, useClients } from "@/hooks/useSupabase";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

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
  const [selectedTemplate, setSelectedTemplate] = useState<Tables<"message_templates"> | null>(null);
  const [selectedClient, setSelectedClient] = useState<Tables<"clients"> | null>(null);
  const [clientSearch, setClientSearch] = useState("");

  const { data: templates, isLoading } = useMessageTemplates(filter);
  const { data: allClients } = useClients();

  const replaceVars = (msg: string, client?: Tables<"clients"> | null) => {
    if (!client) return msg;
    const firstName = client.name.split(" ")[0];
    return msg
      .replace(/\{nome\}/gi, firstName)
      .replace(/\{interesse\}/gi, (client.interest || "motos").toLowerCase())
      .replace(/\{orcamento\}/gi, client.budget_range || "");
  };

  const copy = (id: string, msg: string) => {
    const finalMsg = replaceVars(msg, selectedClient);
    navigator.clipboard.writeText(finalMsg);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Mensagem copiada!");
  };

  const sendWhatsApp = (msg: string) => {
    if (!selectedClient?.phone) {
      toast.error("Selecione um cliente com telefone");
      return;
    }
    const finalMsg = replaceVars(msg, selectedClient);
    const phone = selectedClient.phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(finalMsg)}`);
    toast.success("Abrindo WhatsApp...");
  };

  const filteredClients = (allClients || []).filter(c =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone?.includes(clientSearch)
  ).slice(0, 10);

  const filtered = (templates || []).filter(
    (t) => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.message.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5 max-w-4xl">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-display font-bold">Mensagens</h1>
        <p className="text-sm text-muted-foreground">Templates com variáveis dinâmicas</p>
      </motion.div>

      {/* Client selector */}
      <motion.div variants={fadeUp} className="glass-card gradient-border p-4">
        <p className="text-sm font-medium mb-2 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          {selectedClient ? `Enviando para: ${selectedClient.name}` : "Selecione um cliente"}
        </p>
        {selectedClient ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-secondary/50 rounded-xl px-3 py-2">
              <p className="text-sm font-medium">{selectedClient.name}</p>
              <p className="text-[10px] text-muted-foreground">{selectedClient.phone || "Sem telefone"} · {selectedClient.interest || "Sem interesse"}</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-full text-xs h-8" onClick={() => setSelectedClient(null)}>
              Trocar
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder="Buscar cliente por nome ou telefone..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="rounded-xl bg-secondary border-border/50 h-9 text-sm"
            />
            {clientSearch && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {filteredClients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedClient(c); setClientSearch(""); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-accent/50 text-left transition-colors"
                  >
                    <span className="text-sm font-medium truncate">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{c.phone || ""}</span>
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum cliente encontrado</p>
                )}
              </div>
            )}
          </div>
        )}
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
          {filtered.map((t) => {
            const previewMsg = replaceVars(t.message, selectedClient);
            const hasVars = t.variables && t.variables.length > 0;
            return (
              <motion.div key={t.id} variants={fadeUp} className="glass-card-hover p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{t.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.title}</p>
                    {hasVars && (
                      <div className="flex gap-1 mt-1">
                        {t.variables!.map(v => (
                          <span key={v} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                            {`{${v}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full capitalize ${categoryBadge[t.category] || 'bg-muted/15 text-muted-foreground'}`}>
                    {t.category}
                  </span>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 mb-3">
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{previewMsg}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-full text-xs gap-1.5 flex-1 h-9" onClick={() => copy(t.id, t.message)}>
                    {copiedId === t.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === t.id ? "Copiado!" : "Copiar"}
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full text-xs gap-1.5 h-9 flex-1"
                    disabled={!selectedClient?.phone}
                    onClick={() => sendWhatsApp(t.message)}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {selectedClient?.phone ? "WhatsApp" : "Selecione cliente"}
                  </Button>
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma mensagem encontrada</div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AdminMessages;
