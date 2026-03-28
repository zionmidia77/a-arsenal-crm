import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useClient, useClientInteractions, useClientVehicles, useCreateInteraction, useUpdateClient, useCreateTask } from "@/hooks/useSupabase";
import {
  ArrowLeft, MessageCircle, Phone, Mail, MapPin, Calendar, Bike,
  TrendingUp, Clock, Plus, Star, CalendarPlus, Check, AlertTriangle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const tempBadge: Record<string, string> = {
  hot: "bg-primary/15 text-primary",
  warm: "bg-warning/15 text-warning",
  cold: "bg-info/15 text-info",
  frozen: "bg-muted/15 text-muted-foreground",
};
const tempLabel: Record<string, string> = { hot: "🔥 Quente", warm: "🟡 Morno", cold: "🔵 Frio", frozen: "⚪ Inativo" };

const STAGES = [
  { key: "new", label: "Novo" },
  { key: "contacted", label: "Contatado" },
  { key: "interested", label: "Interessado" },
  { key: "attending", label: "Em atendimento" },
  { key: "thinking", label: "Pensando" },
  { key: "waiting_response", label: "Aguardando" },
  { key: "scheduled", label: "Agendado" },
  { key: "negotiating", label: "Negociando" },
  { key: "closed_won", label: "Fechado ✅" },
  { key: "closed_lost", label: "Perdido ❌" },
];

const stageBadge: Record<string, string> = {
  new: "bg-info/15 text-info",
  contacted: "bg-warning/15 text-warning",
  interested: "bg-primary/15 text-primary",
  attending: "bg-purple-400/15 text-purple-400",
  thinking: "bg-amber-400/15 text-amber-400",
  waiting_response: "bg-cyan-400/15 text-cyan-400",
  scheduled: "bg-indigo-400/15 text-indigo-400",
  negotiating: "bg-success/15 text-success",
  closed_won: "bg-success text-success-foreground",
  closed_lost: "bg-destructive/15 text-destructive",
};

const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const AdminClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: client, isLoading } = useClient(id || "");
  const { data: interactions } = useClientInteractions(id || "");
  const { data: vehicles } = useClientVehicles(id || "");
  const createInteraction = useCreateInteraction();
  const updateClient = useUpdateClient();
  const createTask = useCreateTask();
  const [note, setNote] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split("T")[0]);
  const [scheduleReason, setScheduleReason] = useState("");

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-5 text-center">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/leads")}>Voltar</Button>
      </div>
    );
  }

  const addNote = () => {
    if (!note.trim()) return;
    createInteraction.mutate({
      client_id: client.id,
      type: "system",
      content: note,
      created_by: "admin",
    });
    setNote("");
    toast.success("Nota adicionada!");
  };

  const changeStage = (stage: string) => {
    updateClient.mutate({ id: client.id, pipeline_stage: stage as any });
    toast.success(`Status atualizado para ${STAGES.find(s => s.key === stage)?.label}`);
  };

  const changeTemperature = (temp: string) => {
    updateClient.mutate({ id: client.id, temperature: temp as any });
    toast.success("Temperatura atualizada!");
  };

  const markAttended = () => {
    updateClient.mutate({ id: client.id, pipeline_stage: "contacted" as any, last_contact_at: new Date().toISOString() } as any);
    createInteraction.mutate({
      client_id: client.id,
      type: "system",
      content: "Marcado como atendido",
      created_by: "admin",
    });
    toast.success("Marcado como atendido!");
  };

  const scheduleFollowUp = () => {
    if (!scheduleReason.trim()) {
      toast.error("Adicione um motivo");
      return;
    }
    createTask.mutate({
      client_id: client.id,
      type: "follow_up",
      reason: scheduleReason,
      due_date: scheduleDate,
      status: "pending",
    });
    createInteraction.mutate({
      client_id: client.id,
      type: "system",
      content: `Follow-up agendado para ${new Date(scheduleDate).toLocaleDateString("pt-BR")}: ${scheduleReason}`,
      created_by: "admin",
    });
    setShowSchedule(false);
    setScheduleReason("");
    toast.success("Follow-up agendado!");
  };

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5 max-w-4xl">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold">{client.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tempBadge[client.temperature]}`}>
              {tempLabel[client.temperature]}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${stageBadge[client.pipeline_stage] || ''}`}>
              {STAGES.find(s => s.key === client.pipeline_stage)?.label}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Score</p>
          <p className="text-lg font-display font-bold text-primary">{client.lead_score}</p>
        </div>
      </motion.div>

      {/* ⚡ Quick Actions Bar */}
      <motion.div variants={fadeUp} className="grid grid-cols-4 gap-2">
        {client.phone && (
          <Button className="h-14 rounded-xl flex flex-col gap-1 text-xs glow-red" onClick={() => window.open(`https://wa.me/55${client.phone?.replace(/\D/g, "")}`)}>
            <MessageCircle className="w-5 h-5" />
            WhatsApp
          </Button>
        )}
        <Button variant="outline" className="h-14 rounded-xl flex flex-col gap-1 text-xs border-primary/30" onClick={markAttended}>
          <Check className="w-5 h-5" />
          Atendido
        </Button>
        <Button variant="outline" className="h-14 rounded-xl flex flex-col gap-1 text-xs border-primary/30" onClick={() => setShowSchedule(!showSchedule)}>
          <CalendarPlus className="w-5 h-5" />
          Agendar
        </Button>
        {client.phone && (
          <Button variant="outline" className="h-14 rounded-xl flex flex-col gap-1 text-xs border-primary/30" onClick={() => window.open(`tel:${client.phone}`)}>
            <Phone className="w-5 h-5" />
            Ligar
          </Button>
        )}
      </motion.div>

      {/* Schedule Follow-up */}
      {showSchedule && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="glass-card p-4 space-y-3"
        >
          <p className="text-sm font-medium flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-primary" /> Agendar retorno
          </p>
          <Input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="rounded-xl bg-secondary border-border/50 h-10"
          />
          <Input
            value={scheduleReason}
            onChange={(e) => setScheduleReason(e.target.value)}
            placeholder="Ex: Ligar às 18h sobre CB 500..."
            className="rounded-xl bg-secondary border-border/50 h-10"
          />
          <div className="flex gap-2">
            <Button onClick={scheduleFollowUp} className="flex-1 rounded-xl h-10">
              <CalendarPlus className="w-4 h-4 mr-2" /> Agendar
            </Button>
            <Button variant="outline" onClick={() => setShowSchedule(false)} className="rounded-xl h-10">
              Cancelar
            </Button>
          </div>
        </motion.div>
      )}

      {/* Contact Info */}
      <motion.div variants={fadeUp} className="glass-card p-4 space-y-3">
        {client.phone && (
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{client.phone}</span>
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{client.email}</span>
          </div>
        )}
        {client.city && (
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{client.city}</span>
          </div>
        )}
        {client.interest && (
          <div className="flex items-center gap-3">
            <Star className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{client.interest}</span>
          </div>
        )}
        {client.budget_range && (
          <div className="flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Orçamento: {client.budget_range}</span>
          </div>
        )}
      </motion.div>

      {/* Temperature */}
      <motion.div variants={fadeUp} className="glass-card p-4">
        <p className="text-sm font-medium mb-3">Temperatura</p>
        <div className="flex gap-2">
          {(["hot", "warm", "cold", "frozen"] as const).map(temp => (
            <Button
              key={temp}
              size="sm"
              variant={client.temperature === temp ? "default" : "outline"}
              className="rounded-full text-xs flex-1 h-9"
              onClick={() => changeTemperature(temp)}
            >
              {tempLabel[temp]}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Pipeline Stage */}
      <motion.div variants={fadeUp} className="glass-card p-4">
        <p className="text-sm font-medium mb-3">Pipeline</p>
        <div className="flex gap-1.5 overflow-x-auto">
          {STAGES.map((stage) => (
            <Button
              key={stage.key}
              size="sm"
              variant={client.pipeline_stage === stage.key ? "default" : "outline"}
              className="rounded-full text-[10px] shrink-0 h-7"
              onClick={() => changeStage(stage.key)}
            >
              {stage.label}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Vehicles */}
      {vehicles && vehicles.length > 0 && (
        <motion.div variants={fadeUp}>
          <h2 className="font-display font-semibold text-sm mb-2 flex items-center gap-2"><Bike className="w-4 h-4" /> Veículos</h2>
          <div className="space-y-2">
            {vehicles.map((v) => (
              <div key={v.id} className="glass-card p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{v.brand} {v.model} {v.year}</p>
                  <p className="text-xs text-muted-foreground">{v.is_financed ? `${v.installments_paid}/${v.installments_total} parcelas` : "Quitada"}</p>
                </div>
                {v.estimated_value && <p className="text-sm font-display font-bold text-primary">R$ {v.estimated_value.toLocaleString("pt-BR")}</p>}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Add Note */}
      <motion.div variants={fadeUp} className="glass-card p-4">
        <p className="text-sm font-medium mb-3">Adicionar nota</p>
        <div className="flex gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Ex: Cliente interessado em CB 500..." className="rounded-xl bg-secondary border-border/50 h-10" />
          <Button size="icon" className="rounded-xl h-10 w-10 shrink-0" onClick={addNote}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      {/* Timeline */}
      <motion.div variants={fadeUp}>
        <h2 className="font-display font-semibold text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Timeline</h2>
        {interactions && interactions.length > 0 ? (
          <div className="space-y-2">
            {interactions.map((int) => (
              <div key={int.id} className="glass-card p-3 border-l-2 border-primary/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground capitalize bg-secondary px-2 py-0.5 rounded-full">{int.type}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(int.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <p className="text-sm text-foreground/80">{int.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma interação registrada</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AdminClientDetail;
