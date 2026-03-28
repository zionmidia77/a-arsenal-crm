import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, User, Clock, ArrowRight, UserCheck, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*, clients(name, phone)")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as Conversation[];
    },
    refetchInterval: 10000,
  });

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
          {conversations.length} conversas
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Conversation list */}
        <div className="lg:col-span-1 space-y-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Carregando...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Nenhuma conversa ainda</div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2 pr-2">
                {conversations.map((convo) => {
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
