import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateClient } from "@/hooks/useSupabase";
import { X, Phone, Send, FileText, FolderOpen, RotateCcw, MapPin, Landmark, Clock, Handshake, Mail } from "lucide-react";
import { toast } from "sonner";

const actionOptions = [
  { type: "call", label: "Ligar", icon: Phone, emoji: "📞" },
  { type: "send_message", label: "Enviar mensagem", icon: Send, emoji: "💬" },
  { type: "send_proposal", label: "Enviar proposta", icon: FileText, emoji: "📋" },
  { type: "collect_docs", label: "Coletar docs", icon: FolderOpen, emoji: "📄" },
  { type: "follow_up", label: "Follow-up", icon: RotateCcw, emoji: "🔁" },
  { type: "schedule_visit", label: "Agendar visita", icon: MapPin, emoji: "📍" },
  { type: "submit_credit", label: "Submeter crédito", icon: Landmark, emoji: "🏦" },
  { type: "wait_client", label: "Aguardar cliente", icon: Clock, emoji: "⏳" },
  { type: "close_deal", label: "Fechar negócio", icon: Handshake, emoji: "🤝" },
  { type: "send_content", label: "Enviar conteúdo", icon: Mail, emoji: "📤" },
] as const;

interface NextActionModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

const NextActionModal = ({ open, onClose, clientId, clientName }: NextActionModalProps) => {
  const updateClient = useUpdateClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!selected) {
      toast.error("Selecione uma ação");
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const opt = actionOptions.find(a => a.type === selected);

    updateClient.mutate({
      id: clientId,
      next_action_type: selected as any,
      next_action: description || `${opt?.emoji} ${opt?.label}`,
      next_action_due: tomorrow.toISOString(),
    } as any);

    toast.success("Próxima ação definida!");
    setSelected(null);
    setDescription("");
    onClose();
  };

  const handleSkip = () => {
    setSelected(null);
    setDescription("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={handleSkip}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md mx-4 mb-4 md:mb-0 bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-display font-bold">Qual a próxima ação?</p>
                <p className="text-xs text-muted-foreground">{clientName}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleSkip}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {actionOptions.slice(0, 8).map((opt) => (
                <motion.button
                  key={opt.type}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelected(opt.type)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                    selected === opt.type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 bg-secondary/30 hover:bg-secondary/60 text-foreground/80"
                  }`}
                >
                  <span>{opt.emoji}</span>
                  {opt.label}
                </motion.button>
              ))}
            </div>

            {selected && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <Input
                  placeholder="Detalhe (opcional): ex: Ligar às 14h"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-sm rounded-xl"
                />
              </motion.div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 text-xs" onClick={handleSkip}>
                Pular
              </Button>
              <Button className="flex-1 text-xs" onClick={handleSubmit} disabled={!selected}>
                Definir ação
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NextActionModal;
