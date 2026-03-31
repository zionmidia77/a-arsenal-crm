import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Bot, Plus, Activity, Users, Zap, AlertTriangle, CheckCircle2, XCircle, MessageSquare, RefreshCw, Settings2, Clock, Radio, Send, Trash2, ListOrdered, CalendarPlus, BarChart3 } from "lucide-react";
import BotPerformanceDashboard from "@/components/admin/BotPerformanceDashboard";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type BotConfig = {
  id: string;
  seller_name: string;
  seller_email: string | null;
  facebook_account: string | null;
  platform: string;
  is_active: boolean;
  max_per_cycle: number;
  delay_seconds: number;
  dry_mode: boolean;
  leads_captured_today: number;
  last_reset_at: string | null;
  created_at: string;
  updated_at: string;
  bot_type: string | null;
  schedule_time: string | null;
  last_heartbeat_at: string | null;
  last_run_at: string | null;
};

type BotLog = {
  id: string;
  bot_config_id: string;
  event_type: string;
  platform: string;
  contact_name: string | null;
  message_in: string | null;
  message_out: string | null;
  lead_created: boolean;
  client_id: string | null;
  error: string | null;
  created_at: string;
};

// Heartbeat status helper
const getHeartbeatStatus = (lastHeartbeat: string | null): { color: string; label: string; bgClass: string } => {
  if (!lastHeartbeat) return { color: "bg-red-500", label: "Nunca conectou", bgClass: "bg-red-500/10" };
  const diffMs = Date.now() - new Date(lastHeartbeat).getTime();
  const diffMin = diffMs / 60000;
  if (diffMin < 5) return { color: "bg-green-500", label: `Visto ${formatDistanceToNow(new Date(lastHeartbeat), { locale: ptBR, addSuffix: true })}`, bgClass: "bg-green-500/10" };
  if (diffMin < 15) return { color: "bg-yellow-500", label: `Visto ${formatDistanceToNow(new Date(lastHeartbeat), { locale: ptBR, addSuffix: true })}`, bgClass: "bg-yellow-500/10" };
  return { color: "bg-red-500", label: `Offline — visto ${formatDistanceToNow(new Date(lastHeartbeat), { locale: ptBR, addSuffix: true })}`, bgClass: "bg-red-500/10" };
};

const getBotTypeLabel = (botType: string | null) => {
  if (botType === "posting") return { label: "Postagem", icon: Send, color: "text-orange-500" };
  return { label: "Mensageria", icon: MessageSquare, color: "text-blue-500" };
};

const useBotConfigs = () =>
  useQuery({
    queryKey: ["bot-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bot_configs")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]).map((d) => ({
        ...d,
        bot_type: d.bot_type ?? "messaging",
        schedule_time: d.schedule_time ?? null,
        last_heartbeat_at: d.last_heartbeat_at ?? null,
        last_run_at: d.last_run_at ?? null,
      })) as BotConfig[];
    },
  });

const useBotLogs = (configId?: string) =>
  useQuery({
    queryKey: ["bot-logs", configId],
    queryFn: async () => {
      let query = supabase.from("bot_logs").select("*").order("created_at", { ascending: false }).limit(100);
      if (configId) query = query.eq("bot_config_id", configId);
      const { data, error } = await query;
      if (error) throw error;
      return data as BotLog[];
    },
    refetchInterval: 5000,
  });

const AdminBotPanel = () => {
  const qc = useQueryClient();
  const { data: configs, isLoading } = useBotConfigs();
  const [selectedBot, setSelectedBot] = useState<string | undefined>();
  const { data: logs } = useBotLogs(selectedBot);
  const [addOpen, setAddOpen] = useState(false);
  const [editBot, setEditBot] = useState<BotConfig | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<BotConfig | null>(null);
  const [, setTick] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleVehicleId, setScheduleVehicleId] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  // Posting queue query
  const { data: queueItems } = useQuery({
    queryKey: ["posting-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bot_posting_queue" as any)
        .select("*, stock_vehicles(brand, model, year, local_bot_id)")
        .order("scheduled_for", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // Stock vehicles for schedule modal
  const { data: stockVehicles } = useQuery({
    queryKey: ["stock-vehicles-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_vehicles")
        .select("id, brand, model, year, local_bot_id")
        .not("local_bot_id", "is", null)
        .order("brand");
      if (error) throw error;
      return data;
    },
  });

  const schedulePosting = useMutation({
    mutationFn: async ({ vehicleId, scheduledFor }: { vehicleId: string; scheduledFor: string | null }) => {
      const vehicle = stockVehicles?.find((v) => v.id === vehicleId);
      if (!vehicle?.local_bot_id) throw new Error("Veículo sem local_bot_id");
      const { error } = await supabase.from("bot_posting_queue" as any).insert({
        vehicle_id: vehicleId,
        local_bot_id: vehicle.local_bot_id,
        scheduled_for: scheduledFor || new Date().toISOString(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posting-queue"] });
      setScheduleOpen(false);
      setScheduleVehicleId("");
      setScheduleTime("");
      toast.success("Postagem agendada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeQueueItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bot_posting_queue" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posting-queue"] });
      toast.success("Removido da fila!");
    },
  });

  // Tick every 30s to update heartbeat labels
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Realtime subscription for bot_configs, bot_logs AND bot_posting_queue
  useEffect(() => {
    const channel = supabase
      .channel("bot-panel-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_configs" }, () => {
        qc.invalidateQueries({ queryKey: ["bot-configs"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bot_logs" }, () => {
        qc.invalidateQueries({ queryKey: ["bot-logs"] });
        qc.invalidateQueries({ queryKey: ["bot-configs"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_posting_queue" }, () => {
        qc.invalidateQueries({ queryKey: ["posting-queue"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const toggleBot = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("bot_configs").update({ is_active, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["bot-configs"] });
      toast.success(vars.is_active ? "Bot ativado!" : "Bot desativado!");
    },
  });

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase.from("bot_configs").update({ [field]: value, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bot-configs"] });
      toast.success("Atualizado!");
    },
  });

  const createBot = useMutation({
    mutationFn: async (config: Partial<BotConfig>) => {
      const { error } = await supabase.from("bot_configs").insert(config as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bot-configs"] });
      setAddOpen(false);
      toast.success("Bot criado com sucesso!");
    },
  });

  const updateBot = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BotConfig> & { id: string }) => {
      const { error } = await supabase.from("bot_configs").update({ ...updates, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bot-configs"] });
      setEditBot(null);
      toast.success("Configuração salva!");
    },
  });

  const handleToggle = (bot: BotConfig, checked: boolean) => {
    if (!checked) {
      setConfirmDeactivate(bot);
    } else {
      toggleBot.mutate({ id: bot.id, is_active: true });
    }
  };

  const totalLeadsToday = configs?.reduce((sum, c) => sum + (c.leads_captured_today || 0), 0) || 0;
  const activeBots = configs?.filter((c) => c.is_active).length || 0;
  const totalBots = configs?.length || 0;
  const onlineBots = configs?.filter((c) => {
    if (!c.last_heartbeat_at) return false;
    return (Date.now() - new Date(c.last_heartbeat_at).getTime()) < 5 * 60000;
  }).length || 0;
  const errorLogs = logs?.filter((l) => l.error).length || 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            Centro de Comando — Bots
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Controle total dos bots de mensageria e postagem</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Novo Bot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Bot</DialogTitle>
            </DialogHeader>
            <BotForm
              onSubmit={(data) => createBot.mutate(data)}
              loading={createBot.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Bot} label="Bots Ativos" value={`${activeBots}/${totalBots}`} color="text-primary" />
        <StatCard icon={Radio} label="Online Agora" value={onlineBots.toString()} color="text-green-500" />
        <StatCard icon={Users} label="Leads Hoje" value={totalLeadsToday.toString()} color="text-blue-500" />
        <StatCard icon={AlertTriangle} label="Erros" value={errorLogs.toString()} color="text-destructive" />
      </div>

      {/* Bot Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-56" />
            </Card>
          ))
        ) : configs?.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
              <Bot className="w-12 h-12 text-muted-foreground/30" />
              <p className="text-muted-foreground">Nenhum bot configurado</p>
              <Button variant="outline" onClick={() => setAddOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Criar primeiro bot
              </Button>
            </CardContent>
          </Card>
        ) : (
          configs?.map((bot) => {
            const heartbeat = getHeartbeatStatus(bot.last_heartbeat_at);
            const typeInfo = getBotTypeLabel(bot.bot_type);
            const TypeIcon = typeInfo.icon;

            return (
              <Card
                key={bot.id}
                className={`cursor-pointer transition-all border-2 ${
                  selectedBot === bot.id ? "border-primary" : "border-transparent hover:border-border"
                }`}
                onClick={() => setSelectedBot(selectedBot === bot.id ? undefined : bot.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TypeIcon className={`w-4 h-4 ${typeInfo.color}`} />
                      {bot.seller_name}
                      <Badge variant="outline" className="text-[10px] font-normal capitalize">
                        {typeInfo.label}
                      </Badge>
                    </CardTitle>
                    <Switch
                      checked={bot.is_active}
                      onCheckedChange={(checked) => handleToggle(bot, checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Heartbeat status */}
                  <div className={`flex items-center gap-2 p-2 rounded-lg ${heartbeat.bgClass}`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${heartbeat.color} ${heartbeat.color === "bg-green-500" ? "animate-pulse" : ""}`} />
                    <span className="text-xs font-medium">{heartbeat.label}</span>
                  </div>

                  {/* Leads today */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Leads capturados hoje</span>
                    <span className="font-bold text-primary text-2xl">{bot.leads_captured_today}</span>
                  </div>

                  {/* Dry mode toggle */}
                  <div className="flex items-center justify-between text-sm" onClick={(e) => e.stopPropagation()}>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Modo Teste (Dry)
                    </span>
                    <Switch
                      checked={bot.dry_mode}
                      onCheckedChange={(v) => updateField.mutate({ id: bot.id, field: "dry_mode", value: v })}
                    />
                  </div>

                  {/* Schedule time — only for posting bot */}
                  {bot.bot_type === "posting" && (
                    <div className="flex items-center justify-between text-sm" onClick={(e) => e.stopPropagation()}>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Horário
                      </span>
                      <Input
                        type="time"
                        className="w-28 h-7 text-xs"
                        value={bot.schedule_time || ""}
                        onChange={(e) => updateField.mutate({ id: bot.id, field: "schedule_time", value: e.target.value || null })}
                      />
                    </div>
                  )}

                  {/* Config summary */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Settings2 className="w-3 h-3" />
                    <span>Max: {bot.max_per_cycle}/ciclo · Delay: {bot.delay_seconds}s</span>
                    {bot.dry_mode && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-600 border-yellow-300">DRY</Badge>}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 gap-1"
                    onClick={(e) => { e.stopPropagation(); setEditBot(bot); }}
                  >
                    <Settings2 className="w-3.5 h-3.5" /> Configurar
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Deactivation confirmation */}
      <AlertDialog open={!!confirmDeactivate} onOpenChange={(open) => !open && setConfirmDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {confirmDeactivate?.seller_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O bot vai parar de operar na próxima verificação (até 60s). Você pode reativá-lo a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeactivate) {
                  toggleBot.mutate({ id: confirmDeactivate.id, is_active: false });
                }
                setConfirmDeactivate(null);
              }}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <Dialog open={!!editBot} onOpenChange={(open) => !open && setEditBot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Bot — {editBot?.seller_name}</DialogTitle>
          </DialogHeader>
          {editBot && (
            <BotForm
              initial={editBot}
              onSubmit={(data) => updateBot.mutate({ id: editBot.id, ...data })}
              loading={updateBot.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Posting Queue */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-primary" />
              Fila de Postagem
              <Badge variant="secondary" className="text-xs">
                {queueItems?.filter((q) => q.status === "pending").length || 0} pendentes
              </Badge>
            </CardTitle>
            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <CalendarPlus className="w-3.5 h-3.5" /> Agendar Postagem
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agendar Postagem</DialogTitle>
                  <DialogDescription>Selecione o veículo e horário para publicar no Marketplace</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Veículo *</Label>
                    <Select value={scheduleVehicleId} onValueChange={setScheduleVehicleId}>
                      <SelectTrigger><SelectValue placeholder="Selecione um veículo" /></SelectTrigger>
                      <SelectContent>
                        {stockVehicles?.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            [{v.local_bot_id}] {v.brand} {v.model} {v.year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Horário (opcional — vazio = agora)</Label>
                    <Input
                      type="datetime-local"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={!scheduleVehicleId || schedulePosting.isPending}
                    onClick={() => schedulePosting.mutate({
                      vehicleId: scheduleVehicleId,
                      scheduledFor: scheduleTime ? new Date(scheduleTime).toISOString() : null,
                    })}
                  >
                    {schedulePosting.isPending ? "Agendando..." : "Agendar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Bot</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Agendado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!queueItems?.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      <ListOrdered className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Fila vazia
                    </TableCell>
                  </TableRow>
                ) : (
                  queueItems.map((item) => {
                    const sv = item.stock_vehicles;
                    return (
                      <TableRow key={item.id} className={item.status === "error" ? "bg-destructive/5" : item.status === "posted" ? "bg-green-500/5" : ""}>
                        <TableCell className="font-mono text-xs">{item.local_bot_id}</TableCell>
                        <TableCell className="text-sm">
                          {sv ? `${sv.brand} ${sv.model} ${sv.year}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(item.scheduled_for), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.status === "posted" ? "default" : item.status === "error" ? "destructive" : "secondary"} className="text-xs capitalize">
                            {item.status === "posted" ? "✓ Publicado" : item.status === "error" ? `❌ ${item.error_msg || "Erro"}` : "⏳ Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeQueueItem.mutate(item.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Logs em Tempo Real
              {selectedBot && (
                <Badge variant="secondary" className="text-xs">
                  Filtrado por bot
                </Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["bot-logs"] })} className="gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="hidden md:table-cell">Mensagem</TableHead>
                  <TableHead className="text-center">Lead?</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!logs?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nenhum log registrado ainda
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className={log.error ? "bg-destructive/5" : log.lead_created ? "bg-green-500/5" : ""}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.event_type === "error" ? "destructive" : "secondary"} className="text-xs capitalize">
                          {log.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium truncate max-w-[120px]">{log.contact_name || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground truncate max-w-[200px]">
                        {log.message_in || log.message_out || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.lead_created ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell>
                        {log.error ? (
                          <span className="text-xs text-destructive truncate block max-w-[150px]" title={log.error}>
                            ❌ {log.error}
                          </span>
                        ) : (
                          <span className="text-xs text-green-600">✓ OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

// Stat card component
const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-accent ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </CardContent>
  </Card>
);

// Bot form component
const BotForm = ({ initial, onSubmit, loading }: { initial?: BotConfig; onSubmit: (data: any) => void; loading: boolean }) => {
  const [form, setForm] = useState({
    seller_name: initial?.seller_name || "",
    seller_email: initial?.seller_email || "",
    facebook_account: initial?.facebook_account || "",
    platform: initial?.platform || "facebook_marketplace",
    max_per_cycle: initial?.max_per_cycle || 5,
    delay_seconds: initial?.delay_seconds || 30,
    dry_mode: initial?.dry_mode || false,
    bot_type: initial?.bot_type || "messaging",
    schedule_time: initial?.schedule_time || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.seller_name.trim()) return toast.error("Nome do vendedor é obrigatório");
    onSubmit({
      ...form,
      schedule_time: form.schedule_time || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do Bot / Vendedor *</Label>
        <Input value={form.seller_name} onChange={(e) => setForm({ ...form, seller_name: e.target.value })} placeholder="Ex: Bot Messenger" />
      </div>
      <div className="space-y-2">
        <Label>Tipo do Bot</Label>
        <Select value={form.bot_type} onValueChange={(v) => setForm({ ...form, bot_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="messaging">Mensageria (responde mensagens)</SelectItem>
            <SelectItem value="posting">Postagem (publica anúncios)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={form.seller_email} onChange={(e) => setForm({ ...form, seller_email: e.target.value })} placeholder="lucas@empresa.com" />
      </div>
      <div className="space-y-2">
        <Label>Conta Facebook</Label>
        <Input value={form.facebook_account} onChange={(e) => setForm({ ...form, facebook_account: e.target.value })} placeholder="URL ou ID da conta" />
      </div>
      <div className="space-y-2">
        <Label>Plataforma</Label>
        <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="facebook_marketplace">Facebook Marketplace</SelectItem>
            <SelectItem value="facebook">Facebook Messenger</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="instagram">Instagram DM</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {form.bot_type === "posting" && (
        <div className="space-y-2">
          <Label>Horário de Postagem</Label>
          <Input type="time" value={form.schedule_time} onChange={(e) => setForm({ ...form, schedule_time: e.target.value })} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Max por Ciclo</Label>
          <Input type="number" value={form.max_per_cycle} onChange={(e) => setForm({ ...form, max_per_cycle: parseInt(e.target.value) || 5 })} />
        </div>
        <div className="space-y-2">
          <Label>Delay (seg)</Label>
          <Input type="number" value={form.delay_seconds} onChange={(e) => setForm({ ...form, delay_seconds: parseInt(e.target.value) || 30 })} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label className="cursor-pointer">Modo Teste (não executa ações reais)</Label>
        <Switch checked={form.dry_mode} onCheckedChange={(v) => setForm({ ...form, dry_mode: v })} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando..." : initial ? "Salvar Alterações" : "Criar Bot"}
      </Button>
    </form>
  );
};

export default AdminBotPanel;
