import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Copy, Clipboard, ChevronDown, ChevronUp, Sparkles, Target, AlertTriangle, MessageCircle, Zap, ThermometerSun, Tag, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLeadCopilot, useLeadMemory } from "@/hooks/useLeadCopilot";
import ReactMarkdown from "react-markdown";

interface LeadCopilotPanelProps {
  clientId: string;
  clientName: string;
}

const QUICK_COMMANDS = [
  { label: "📊 Análise completa", cmd: "Faça uma análise completa deste lead com diagnóstico, temperatura, objeções e próxima ação." },
  { label: "💬 Gerar mensagem", cmd: "Gere uma mensagem pronta para enviar no WhatsApp para este lead agora." },
  { label: "🎯 Próxima ação", cmd: "Qual a melhor próxima ação para este lead? O que eu devo fazer agora?" },
  { label: "⚡ Quebrar objeção", cmd: "Quais são as principais objeções deste lead e como posso quebrá-las?" },
  { label: "📝 Proposta", cmd: "Monte uma proposta personalizada para este cliente considerando seu perfil financeiro." },
  { label: "🔄 Reativação", cmd: "Crie uma mensagem de reativação para este lead que está inativo." },
  { label: "🌡️ Temperatura", cmd: "Esse lead está quente, morno ou frio? Justifique com dados." },
  { label: "🏍️ Sugerir veículo", cmd: "Qual o melhor veículo para recomendar a este cliente baseado no perfil dele?" },
];

const LeadCopilotPanel = ({ clientId, clientName }: LeadCopilotPanelProps) => {
  const copilot = useLeadCopilot(clientId);
  const { data: memory } = useLeadMemory(clientId);
  const [input, setInput] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showMemory, setShowMemory] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleSend = () => {
    if (!input.trim() || copilot.isLoading) return;
    copilot.sendMessage(input.trim());
    setInput("");
  };

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    copilot.pasteWhatsApp(pasteText.trim());
    setPasteText("");
    setShowPaste(false);
  };

  const copyToClipboard = (text: string) => {
    // Extract message after "Mensagem pronta:" or similar patterns
    const msgMatch = text.match(/(?:mensagem pronta|💬.*?mensagem|copie.*?envie)[:\s]*\n*([^]*?)(?:\n\n\*\*|$)/i);
    const toCopy = msgMatch ? msgMatch[1].trim() : text;
    navigator.clipboard.writeText(toCopy);
    toast.success("Mensagem copiada!");
  };

  const tempColors: Record<string, string> = {
    hot: "text-primary bg-primary/10",
    warm: "text-warning bg-warning/10",
    cold: "text-info bg-info/10",
    frozen: "text-muted-foreground bg-muted/10",
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-4 hover:bg-accent/50 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold">AI Copilot</p>
          <p className="text-[10px] text-muted-foreground">Assistente exclusivo para {clientName}</p>
        </div>
        {memory?.lead_temperature_ai && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tempColors[memory.lead_temperature_ai] || ""}`}>
            {memory.lead_temperature_ai === "hot" ? "🔥 Quente" : memory.lead_temperature_ai === "warm" ? "🟡 Morno" : memory.lead_temperature_ai === "cold" ? "🔵 Frio" : "⚪ Inativo"}
          </span>
        )}
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Memory Summary Card */}
            {memory && (
              <div className="px-4 pb-3">
                <button onClick={() => setShowMemory(!showMemory)} className="w-full text-left">
                  <div className="bg-secondary/50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                      Memória do Lead
                      {showMemory ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                    </div>

                    {memory.recommended_action && (
                      <div className="flex items-start gap-2 bg-primary/5 rounded-lg p-2">
                        <Target className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <p className="text-[11px] text-foreground/80">{memory.recommended_action}</p>
                      </div>
                    )}

                    {memory.objections && (memory.objections as string[]).length > 0 && (
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-3 h-3 text-warning shrink-0 mt-0.5" />
                        <p className="text-[10px] text-muted-foreground">{(memory.objections as string[]).join(" · ")}</p>
                      </div>
                    )}

                    {memory.ai_tags && (memory.ai_tags as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(memory.ai_tags as string[]).map((tag, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <AnimatePresence>
                      {showMemory && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-2 pt-2 border-t border-border/30"
                        >
                          {memory.summary && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Resumo</p>
                              <p className="text-[11px]">{memory.summary}</p>
                            </div>
                          )}
                          {memory.interests && (memory.interests as string[]).length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Interesses</p>
                              <p className="text-[11px]">{(memory.interests as string[]).join(", ")}</p>
                            </div>
                          )}
                          {memory.behavior_patterns && (memory.behavior_patterns as string[]).length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Padrões</p>
                              <p className="text-[11px]">{(memory.behavior_patterns as string[]).join(", ")}</p>
                            </div>
                          )}
                          {memory.recommended_message && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Mensagem sugerida</p>
                              <div className="bg-card rounded-lg p-2 border border-border/30">
                                <p className="text-[11px]">{memory.recommended_message}</p>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] mt-1 gap-1" onClick={() => copyToClipboard(memory.recommended_message!)}>
                                  <Copy className="w-3 h-3" /> Copiar
                                </Button>
                              </div>
                            </div>
                          )}
                          {memory.last_analyzed_at && (
                            <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Última análise: {new Date(memory.last_analyzed_at).toLocaleString("pt-BR")}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </button>
              </div>
            )}

            {/* Quick Commands */}
            <div className="px-4 pb-3">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {QUICK_COMMANDS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => copilot.sendMessage(q.cmd)}
                    disabled={copilot.isLoading}
                    className="text-[10px] px-2.5 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0 disabled:opacity-50"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* WhatsApp Paste */}
            <div className="px-4 pb-3">
              <button
                onClick={() => setShowPaste(!showPaste)}
                className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Clipboard className="w-3.5 h-3.5" />
                Colar conversa do WhatsApp
              </button>
              <AnimatePresence>
                {showPaste && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 space-y-2"
                  >
                    <Textarea
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      placeholder="Cole aqui a conversa do WhatsApp..."
                      className="min-h-[100px] text-xs rounded-xl bg-secondary border-border/50"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-xl text-xs gap-1" onClick={handlePaste} disabled={!pasteText.trim() || copilot.isLoading}>
                        <Sparkles className="w-3 h-3" /> Analisar
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => { setShowPaste(false); setPasteText(""); }}>
                        Cancelar
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Chat Messages */}
            {copilot.messages.length > 0 && (
              <div className="px-4 pb-3">
                <div className="bg-secondary/30 rounded-xl p-3 max-h-96 overflow-y-auto space-y-3">
                  {copilot.messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[90%] ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3 py-2"
                          : "bg-card border border-border/50 rounded-2xl rounded-bl-md px-3 py-2"
                      }`}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none text-xs [&_p]:mb-1 [&_ul]:mb-1 [&_li]:mb-0.5 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_strong]:text-foreground">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] mt-1 gap-1 text-muted-foreground hover:text-foreground"
                              onClick={() => copyToClipboard(msg.content)}
                            >
                              <Copy className="w-3 h-3" /> Copiar
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {copilot.isLoading && copilot.messages[copilot.messages.length - 1]?.role !== "assistant" && (
                    <div className="flex gap-1.5 px-3 py-2">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="px-4 pb-4">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  placeholder="Pergunte sobre este lead..."
                  className="rounded-xl bg-secondary border-border/50 h-10 text-xs"
                  disabled={copilot.isLoading}
                />
                <Button
                  size="icon"
                  className="rounded-xl h-10 w-10 shrink-0"
                  disabled={!input.trim() || copilot.isLoading}
                  onClick={handleSend}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeadCopilotPanel;
