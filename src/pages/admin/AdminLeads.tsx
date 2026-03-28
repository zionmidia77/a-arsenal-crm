import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle, Copy, Check, Phone } from "lucide-react";

const leads = [
  { id: 1, name: "Carlos Silva", phone: "11999887766", interest: "Comprar - Até 30k", temp: "hot" as const, date: "Hoje 14:32" },
  { id: 2, name: "Ana Oliveira", phone: "11988776655", interest: "Trocar - CB 500", temp: "hot" as const, date: "Hoje 13:10" },
  { id: 3, name: "Pedro Santos", phone: "11977665544", interest: "Vender - MT-03", temp: "warm" as const, date: "Hoje 10:45" },
  { id: 4, name: "Julia Costa", phone: "11966554433", interest: "Comprar - Até 15k", temp: "warm" as const, date: "Ontem" },
  { id: 5, name: "Marcos Lima", phone: "11955443322", interest: "Só olhando", temp: "cold" as const, date: "Ontem" },
];

const tempStyles = { hot: "border-l-red-500 bg-red-500/5", warm: "border-l-yellow-500 bg-yellow-500/5", cold: "border-l-blue-500 bg-blue-500/5" };
const tempEmoji = { hot: "🔥", warm: "🟡", cold: "🔵" };

const AdminLeads = () => {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "hot" | "warm" | "cold">("all");

  const copyMsg = (lead: typeof leads[0]) => {
    navigator.clipboard.writeText(`Fala ${lead.name.split(" ")[0]}! Aqui é da Arsenal Motors 🏍️ Vi que você tem interesse em ${lead.interest.toLowerCase()}. Posso te ajudar?`);
    setCopiedId(lead.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = filter === "all" ? leads : leads.filter((l) => l.temp === filter);

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold">Leads</h1>
        <p className="text-sm text-muted-foreground">{leads.length} leads capturados</p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {(["all", "hot", "warm", "cold"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="rounded-full shrink-0 text-xs">
            {f === "all" ? "Todos" : f === "hot" ? "🔥 Quentes" : f === "warm" ? "🟡 Mornos" : "🔵 Frios"}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((lead, i) => (
          <motion.div key={lead.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`glass-card p-4 border-l-4 ${tempStyles[lead.temp]}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium flex items-center gap-2">{tempEmoji[lead.temp]} {lead.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{lead.interest}</p>
              </div>
              <span className="text-xs text-muted-foreground">{lead.date}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="rounded-full text-xs gap-1.5 flex-1" onClick={() => window.open(`https://wa.me/55${lead.phone}`)}>
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" className="rounded-full text-xs gap-1.5" onClick={() => copyMsg(lead)}>
                {copiedId === lead.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === lead.id ? "Copiado!" : "Copiar msg"}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminLeads;
