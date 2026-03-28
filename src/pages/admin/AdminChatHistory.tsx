import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { MessageSquare, User, Clock, UserCheck, X, Search, CalendarIcon, Filter, Send } from "lucide-react";
import { toast } from "sonner";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  session_id: string;
  client_id: string | null;
  messages: ConversationMessage[];
  status: string;
  transferred_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: { name: string; phone: string | null } | null;
}

const AdminChatHistory = () => {
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*, clients(name, phone)")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as Conversation[];
    },
    refetchInterval: 10000,
  });

  const filteredConversations = useMemo(() => {
    return conversations.filter((convo) => {
      // Status filter
      if (statusFilter !== "all" && convo.status !== statusFilter) return false;

      // Search by client name
      if (searchQuery.trim()) {
        const name = (convo.clients?.name || "Visitante").toLowerCase();
        const phone = (convo.clients?.phone || "").toLowerCase();
        const q = searchQuery.toLowerCase();
        if (!name.includes(q) && !phone.includes(q)) return false;
      }

      // Date range filter
      const convoDate = new Date(convo.created_at);
      if (dateFrom && isBefore(convoDate, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(convoDate, endOfDay(dateTo))) return false;

      return true;
    });
  }, [conversations, statusFilter, searchQuery, dateFrom, dateTo]);

  const hasActiveFilters = statusFilter !== "all" || searchQuery.trim() || dateFrom || dateTo;

  const clearFilters = () => {
    setStatusFilter("all");
    setSearchQuery("");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-emerald-500/20 text-emerald-400";
      case "transferred": return "bg-amber-500/20 text-amber-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Histórico de Conversas IA</h2>
          <p className="text-muted-foreground text-sm">Conversas do Consultor Arsenal com leads</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <MessageSquare className="w-3 h-3" />
          {filteredConversations.length} conversa{filteredConversations.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <Filter className="w-3 h-3 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="transferred">Transferido</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 text-sm gap-1.5", dateFrom && "text-primary border-primary/30")}>
                  <CalendarIcon className="w-3 h-3" />
                  {dateFrom ? format(dateFrom, "dd/MM") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 text-sm gap-1.5", dateTo && "text-primary border-primary/30")}>
                  <CalendarIcon className="w-3 h-3" />
                  {dateTo ? format(dateTo, "dd/MM") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
                <X className="w-3 h-3" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Conversation list */}
        <div className="lg:col-span-1 space-y-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Carregando...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {hasActiveFilters ? "Nenhuma conversa encontrada com esses filtros" : "Nenhuma conversa ainda"}
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2 pr-2">
                {filteredConversations.map((convo) => {
                  const msgCount = Array.isArray(convo.messages) ? convo.messages.length : 0;
                  const lastMsg = Array.isArray(convo.messages) ? convo.messages[convo.messages.length - 1] : null;
                  const clientName = convo.clients?.name || "Visitante";

                  return (
                    <Card
                      key={convo.id}
                      className={`cursor-pointer transition-all hover:border-primary/30 ${selectedConvo?.id === convo.id ? "border-primary/50 bg-primary/5" : ""}`}
                      onClick={() => setSelectedConvo(convo)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium truncate max-w-[140px]">{clientName}</span>
                          </div>
                          <Badge className={`text-[10px] ${statusColor(convo.status)}`}>
                            {convo.status === "transferred" ? "Transferido" : convo.status === "active" ? "Ativo" : convo.status}
                          </Badge>
                        </div>
                        {lastMsg && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {lastMsg.content.slice(0, 60)}...
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {format(new Date(convo.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {msgCount} msgs
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Conversation detail */}
        <div className="lg:col-span-2">
          {selectedConvo ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    {selectedConvo.clients?.name || "Visitante"}
                    {selectedConvo.clients?.phone && (
                      <span className="text-sm font-normal text-muted-foreground">
                        · {selectedConvo.clients.phone}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedConvo.status === "transferred" && (
                      <Badge className="bg-amber-500/20 text-amber-400 gap-1">
                        <UserCheck className="w-3 h-3" /> Transferido
                      </Badge>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setSelectedConvo(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Iniciada em {format(new Date(selectedConvo.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {Array.isArray(selectedConvo.messages) && selectedConvo.messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-secondary rounded-bl-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <p className={`text-[9px] mt-1 ${msg.role === "user" ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
                            {msg.timestamp ? format(new Date(msg.timestamp), "HH:mm") : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex items-center justify-center h-[560px]">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione uma conversa para ver os detalhes</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminChatHistory;
