import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Copy, Check, Search, Phone } from "lucide-react";

const leads = [
  { id: 1, name: "Carlos Silva", phone: "11999887766", interest: "Comprar - Até 30k", temp: "hot" as const, date: "Hoje 14:32", avatar: "CS" },
  { id: 2, name: "Ana Oliveira", phone: "11988776655", interest: "Trocar - CB 500", temp: "hot" as const, date: "Hoje 13:10", avatar: "AO" },
  { id: 3, name: "Pedro Santos", phone: "11977665544", interest: "Vender - MT-03", temp: "warm" as const, date: "Hoje 10:45", avatar: "PS" },
  { id: 4, name: "Julia Costa", phone: "11966554433", interest: "Comprar - Até 15k", temp: "warm" as const, date: "Ontem", avatar: "JC" },
  { id: 5, name: "Marcos Lima", phone: "11955443322", interest: "Só olhando", temp: "cold" as const, date: "Ontem", avatar: "ML" },
];

const tempStyles = {
  hot: "border-l-primary bg-primary/5",
  warm: "border-l-warning bg-warning/5",
  cold: "border-l-info bg-info/5",
};
const tempBadge = {
  hot: "bg-primary/15 text-primary",
  warm: "bg-warning/15 text-warning",
  cold: "bg-info/15 text-info",
};
const tempLabel = { hot: "Quente", warm: "Morno", cold: "Frio" };

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const AdminLeads = () => {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "hot" | "warm" | "cold">("all");
  const [search, setSearch] = useState("");

  const copyMsg = (lead: typeof leads[0]) => {
    navigator.clipboard.writeText(`Fala ${lead.name.split(" ")[0]}! Aqui é da Arsenal Motors 🏍️ Vi que você tem interesse em ${lead.interest.toLowerCase()}. Posso te ajudar?`);
    setCopiedId(lead.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = leads
    .filter((l) => filter === "all" || l.temp === filter)
    .filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5 max-w-4xl">
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-display font-bold">Leads</h1>
        <p className="text-sm text-muted-foreground">{leads.length} leads capturados</p>
      </motion.div>

      {/* Search */}
      <motion.div variants={fadeUp} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar lead..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl bg-secondary border-border/50 h-10"
        />
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto">
        {(["all", "hot", "warm", "cold"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className="rounded-full shrink-0 text-xs"
          >
            {f === "all" ? "Todos" : f === "hot" ? "🔥 Quentes" : f === "warm" ? "🟡 Mornos" : "🔵 Frios"}
          </Button>
        ))}
      </motion.div>

      {/* Lead List */}
      <div className="space-y-3">
        {filtered.map((lead) => (
          <motion.div
            key={lead.id}
            variants={fadeUp}
            className={`glass-card-hover p-4 border-l-4 ${tempStyles[lead.temp]}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${tempBadge[lead.temp]}`}>
                  {lead.avatar}
                </div>
                <div>
                  <p className="font-medium text-sm">{lead.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{lead.interest}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tempBadge[lead.temp]}`}>
                  {tempLabel[lead.temp]}
                </span>
                <p className="text-[10px] text-muted-foreground mt-1">{lead.date}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="rounded-full text-xs gap-1.5 flex-1 h-9"
                onClick={() => window.open(`https://wa.me/55${lead.phone}`)}
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-xs gap-1.5 h-9"
                onClick={() => window.open(`tel:+55${lead.phone}`)}
              >
                <Phone className="w-3.5 h-3.5" /> Ligar
              </Button>
              <Button size="sm" variant="outline" className="rounded-full text-xs gap-1.5 h-9" onClick={() => copyMsg(lead)}>
                {copiedId === lead.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === lead.id ? "Copiado!" : "Msg"}
              </Button>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum lead encontrado
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminLeads;
