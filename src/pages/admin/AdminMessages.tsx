import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

const templates = [
  { id: 1, title: "Primeiro contato", category: "lead", message: "Fala {nome}! Aqui é da Arsenal Motors 🏍️ Vi que você tem interesse em motos. Posso te ajudar a encontrar a ideal?" },
  { id: 2, title: "Follow-up 3 dias", category: "lead", message: "E aí {nome}, tudo bem? Lembra que conversamos sobre motos? Ainda tá pensando? Tenho umas condições especiais essa semana 🔥" },
  { id: 3, title: "Aniversário", category: "relacionamento", message: "Parabéns {nome}! 🎉 Todo mundo aqui da Arsenal te deseja tudo de bom! Se precisar de algo, é só chamar 🤙" },
  { id: 4, title: "Moto valorizada", category: "oportunidade", message: "{nome}, sua {moto} tá super valorizada no mercado agora! Quer saber quanto consegue por ela? Posso fazer uma avaliação rápida 📈" },
  { id: 5, title: "Parcela melhor", category: "oportunidade", message: "Ei {nome}! Achei uma condição que pode baixar sua parcela. Quer dar uma olhada? Sem compromisso 😉" },
  { id: 6, title: "Pós-venda", category: "relacionamento", message: "Fala {nome}! Como tá a {moto}? Qualquer coisa que precisar, estamos aqui. Arsenal Motors cuida de você 💪" },
];

const AdminMessages = () => {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");

  const copy = (id: number, msg: string) => {
    navigator.clipboard.writeText(msg);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = filter === "all" ? templates : templates.filter((t) => t.category === filter);

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold">Mensagens</h1>
        <p className="text-sm text-muted-foreground">Biblioteca de mensagens prontas</p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {["all", "lead", "relacionamento", "oportunidade"].map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="rounded-full shrink-0 text-xs capitalize">
            {f === "all" ? "Todas" : f}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-sm">{t.title}</p>
              <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full capitalize">{t.category}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{t.message}</p>
            <Button size="sm" variant="outline" className="rounded-full text-xs gap-1.5" onClick={() => copy(t.id, t.message)}>
              {copiedId === t.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedId === t.id ? "Copiado!" : "Copiar mensagem"}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminMessages;
