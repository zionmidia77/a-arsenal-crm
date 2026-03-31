import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Plus, Activity, Users, Zap, AlertTriangle, CheckCircle2, XCircle, MessageSquare, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
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

const useBotConfigs = () =>
  useQuery({
    queryKey: ["bot-configs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_configs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as BotConfig[];
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

  // Realtime logs subscription
  useEffect(() => {
    const channel = supabase
      .channel("bot-logs-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bot_logs" }, () => {
        qc.invalidateQueries({ queryKey: ["bot-logs"] });
        qc.invalidateQueries({ queryKey: ["bot-configs"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const toggleBot = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("bot_configs").update({ is_active, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["bot-configs"] });
      toast.success(vars.is_active ? "Bot ativado!" : "Bot desativado!");
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
      const { error } = await supabase.from("bot_configs").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bot-configs"] });
      setEditBot(null);
      toast.success("Configuração salva!");
    },
  });

  const totalLeadsToday = configs?.reduce((sum, c) => sum + (c.leads_captured_today || 0), 0) || 0;
  const activeBots = configs?.filter((c) => c.is_active).length || 0;
  const totalBots = configs?.length || 0;
  const errorLogs = logs?.filter((l) => l.error).length || 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            Painel de Bots
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie bots de mensageria por vendedor</p>
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
        <StatCard icon={Users} label="Leads Hoje" value={totalLeadsToday.toString()} color="text-green-500" />
        <StatCard icon={Activity} label="Logs Recentes" value={(logs?.length || 0).toString()} color="text-blue-500" />
        <StatCard icon={AlertTriangle} label="Erros" value={errorLogs.toString()} color="text-destructive" />
      </div>

      {/* Bot Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-48" />
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
          configs?.map((bot) => (
            <Card
              key={bot.id}
              className={`cursor-pointer transition-all border-2 ${
                selectedBot === bot.id ? "border-primary" : "border-transparent hover:border-border"
              } ${bot.is_active ? "" : "opacity-60"}`}
              onClick={() => setSelectedBot(selectedBot === bot.id ? undefined : bot.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${bot.is_active ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                    {bot.seller_name}
                  </CardTitle>
                  <Switch
                    checked={bot.is_active}
                    onCheckedChange={(checked) => {
                      toggleBot.mutate({ id: bot.id, is_active: checked });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Plataforma</span>
                  <Badge variant="secondary" className="capitalize">{bot.platform}</Badge>
                </div>
                {bot.facebook_account && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Conta</span>
                    <span className="truncate max-w-[150px] text-right">{bot.facebook_account}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Leads hoje</span>
                  <span className="font-bold text-primary text-lg">{bot.leads_captured_today}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Settings2 className="w-3 h-3" />
                  <span>Max: {bot.max_per_cycle}/ciclo · Delay: {bot.delay_seconds}s</span>
                  {bot.dry_mode && <Badge variant="outline" className="text-[10px] px-1.5 py-0">DRY</Badge>}
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
          ))
        )}
      </div>

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
    platform: initial?.platform || "facebook",
    max_per_cycle: initial?.max_per_cycle || 5,
    delay_seconds: initial?.delay_seconds || 30,
    dry_mode: initial?.dry_mode || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.seller_name.trim()) return toast.error("Nome do vendedor é obrigatório");
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do Vendedor *</Label>
        <Input value={form.seller_name} onChange={(e) => setForm({ ...form, seller_name: e.target.value })} placeholder="Ex: Lucas" />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={form.seller_email} onChange={(e) => setForm({ ...form, seller_email: e.target.value })} placeholder="lucas@empresa.com" />
      </div>
      <div className="space-y-2">
        <Label>Conta Facebook/WhatsApp</Label>
        <Input value={form.facebook_account} onChange={(e) => setForm({ ...form, facebook_account: e.target.value })} placeholder="URL ou ID da conta" />
      </div>
      <div className="space-y-2">
        <Label>Plataforma</Label>
        <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="facebook">Facebook Messenger</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="instagram">Instagram DM</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
        <Label className="cursor-pointer">Modo Seco (não envia mensagens)</Label>
        <Switch checked={form.dry_mode} onCheckedChange={(v) => setForm({ ...form, dry_mode: v })} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando..." : initial ? "Salvar Alterações" : "Criar Bot"}
      </Button>
    </form>
  );
};

export default AdminBotPanel;
