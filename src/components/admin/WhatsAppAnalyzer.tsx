import { useState, useCallback, useEffect } from "react";
import { ChevronDown, ChevronUp, Zap, Copy, MessageCircle, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateClient } from "@/hooks/useSupabase";
import type { Tables } from "@/integrations/supabase/types";

interface WhatsAppAnalyzerProps {
  client: Tables<"clients">;
  onSendWhatsApp?: (msg: string) => void;
}

interface AnalysisResult {
  situation: string;
  detected_objection: string;
  objection_changed: boolean;
  detected_temperature: string;
  temperature_changed: boolean;
  strategy: string;
  priority: string;
  response_objective: string;
  next_action: string;
  next_action_type: string;
  suggested_message: string;
  changes_summary: string[];
}

const ANALYZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-whatsapp-message`;

const strategyLabels: Record<string, { emoji: string; label: string; color: string }> = {
  pressionar_forte: { emoji: "⚡", label: "Pressionar forte", color: "text-primary" },
  pressionar_medio: { emoji: "💪", label: "Pressionar médio", color: "text-primary" },
  pressionar_leve: { emoji: "👉", label: "Pressionar leve", color: "text-primary" },
  educar_medio: { emoji: "📚", label: "Educar médio", color: "text-amber-600" },
  educar_leve: { emoji: "📖", label: "Educar leve", color: "text-amber-600" },
  fechar_direto: { emoji: "🏆", label: "Fechar direto", color: "text-green-600" },
  recuperar: { emoji: "🔄", label: "Recuperar", color: "text-info" },
  aguardar: { emoji: "⏳", label: "Aguardar", color: "text-muted-foreground" },
  qualificar: { emoji: "🔍", label: "Qualificar", color: "text-blue-600" },
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  urgente: { label: "🔴 Urgente", color: "text-destructive" },
  normal: { label: "🟡 Normal", color: "text-warning" },
  baixo: { label: "🟢 Baixo", color: "text-green-600" },
};

const objectionLabels: Record<string, string> = {
  price: "💲 Preço", down_payment: "💸 Entrada", installment: "📊 Parcela",
  credit: "🚫 Crédito", trust: "🤝 Confiança", comparison: "⚖️ Comparação",
  trade_undervalued: "📉 Troca", indecision: "🤔 Indecisão", timing: "⏰ Timing", none: "Nenhuma",
};

const tempLabels: Record<string, string> = {
  hot: "🔥 Quente", warm: "🟡 Morno", cold: "🔵 Frio", frozen: "⚪ Inativo",
};

const MAX_REGENERATIONS = 3;
const COOLDOWN_MS = 30_000;

const WhatsAppAnalyzer = ({ client, onSendWhatsApp }: WhatsAppAnalyzerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [editableMessage, setEditableMessage] = useState("");
  const [regenCount, setRegenCount] = useState(0);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(0);
  const [changesApplied, setChangesApplied] = useState(false);

  const qc = useQueryClient();
  const updateClient = useUpdateClient();

  const analyze = useCallback(async () => {
    if (!message.trim()) {
      toast.error("Cole a mensagem do cliente antes de analisar.");
      return;
    }

    const now = Date.now();
    if (now - lastAnalyzedAt < COOLDOWN_MS && lastAnalyzedAt > 0) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - lastAnalyzedAt)) / 1000);
      toast.error(`Aguarde ${remaining}s antes de analisar novamente.`);
      return;
    }

    setIsLoading(true);
    setChangesApplied(false);

    try {
      const resp = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ client_id: client.id, new_message: message.trim() }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 429) throw new Error("Muitas requisições. Aguarde e tente novamente.");
        if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage.");
        throw new Error(err.error || "Erro na análise");
      }

      const { analysis: result } = await resp.json();
      setAnalysis(result);
      setEditableMessage(result.suggested_message);
      setRegenCount(0);
      setLastAnalyzedAt(Date.now());

      qc.invalidateQueries({ queryKey: ["client-interactions", client.id] });
      qc.invalidateQueries({ queryKey: ["lead-timeline", client.id] });
      qc.invalidateQueries({ queryKey: ["lead-memory", client.id] });

      toast.success("Análise concluída!");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao analisar mensagem");
    } finally {
      setIsLoading(false);
    }
  }, [message, client.id, lastAnalyzedAt, qc]);

  const regenerateMessage = useCallback(async (tone: "suave" | "direto" | "forte") => {
    if (regenCount >= MAX_REGENERATIONS) {
      toast.error("Limite de regenerações atingido. Analise uma nova mensagem.");
      return;
    }
    if (!analysis) return;

    setIsLoading(true);
    try {
      const tonePrompts: Record<string, string> = {
        suave: "Reescreva de forma mais suave, empática e acolhedora, mas ainda focada em avançar a venda:",
        direto: "Reescreva de forma mais direta e objetiva, sem rodeios, focada em conversão:",
        forte: "Reescreva com urgência e pressão positiva, usando gatilhos de escassez e decisão:",
      };

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          client_id: client.id,
          messages: [
            {
              role: "user",
              content: `${tonePrompts[tone]}\n\nMensagem original: "${analysis.suggested_message}"\n\nContexto: ${analysis.situation}. Objeção: ${analysis.detected_objection}. Objetivo: ${analysis.response_objective}.\n\nRetorne APENAS a mensagem reescrita, sem explicações.`,
            },
          ],
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Erro ao regenerar");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) result += content;
          } catch { break; }
        }
      }

      if (result.trim()) {
        setEditableMessage(result.trim());
        setRegenCount(prev => prev + 1);
        toast.success(`Mensagem reescrita (tom ${tone})`);
      }
    } catch (e) {
      toast.error("Erro ao regenerar mensagem");
    } finally {
      setIsLoading(false);
    }
  }, [analysis, regenCount, client.id]);

  const applyChanges = useCallback(async () => {
    if (!analysis) return;

    const updates: Record<string, any> = {};

    if (analysis.objection_changed && analysis.detected_objection !== "none") {
      updates.objection_type = analysis.detected_objection;
    }
    if (analysis.temperature_changed) {
      updates.temperature = analysis.detected_temperature;
    }
    updates.next_action = analysis.next_action;
    updates.next_action_type = analysis.next_action_type;

    try {
      await updateClient.mutateAsync({ id: client.id, ...updates });
      setChangesApplied(true);
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      toast.success("Mudanças aplicadas ao lead!");
    } catch (e) {
      toast.error("Erro ao aplicar mudanças");
    }
  }, [analysis, client.id, updateClient, qc]);

  const copyMsg = () => {
    navigator.clipboard.writeText(editableMessage);
    toast.success("Mensagem copiada!");
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium">📱 Atualizar com mensagem do WhatsApp</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/40">
          {/* Input area */}
          <div className="pt-3 space-y-2">
            <Textarea
              placeholder="Cole aqui a última mensagem do cliente..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[80px] text-sm resize-none"
              disabled={isLoading}
            />
            <Button
              onClick={analyze}
              disabled={isLoading || !message.trim()}
              className="w-full gap-2 rounded-xl"
              size="sm"
            >
              {isLoading ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
              ) : (
                <><Zap className="w-3.5 h-3.5" /> Analisar agora</>
              )}
            </Button>
          </div>

          {/* Analysis results */}
          {analysis && (
            <div className="space-y-3 pt-2">
              {/* Changes summary */}
              {analysis.changes_summary.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1">
                  <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">🔄 O que mudou</p>
                  {analysis.changes_summary.map((change, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="text-xs text-amber-700 dark:text-amber-400">{change}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Strategy + Priority + Objective */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {strategyLabels[analysis.strategy] && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border border-border/50 bg-secondary/50 ${strategyLabels[analysis.strategy].color}`}>
                      {strategyLabels[analysis.strategy].emoji} {strategyLabels[analysis.strategy].label}
                    </span>
                  )}
                  {priorityLabels[analysis.priority] && (
                    <span className={`text-xs font-medium ${priorityLabels[analysis.priority].color}`}>
                      {priorityLabels[analysis.priority].label}
                    </span>
                  )}
                </div>

                {/* Objective */}
                <div className="bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">🎯 Objetivo da resposta</p>
                  <p className="text-sm font-medium text-foreground">{analysis.response_objective}</p>
                </div>
              </div>

              {/* Situation + Next action */}
              <div className="space-y-1.5">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">📍 Situação</p>
                  <p className="text-sm">{analysis.situation}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">🎯 O que fazer</p>
                  <p className="text-sm font-medium">{analysis.next_action}</p>
                </div>
              </div>

              {/* Objection change warning */}
              {analysis.objection_changed && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  <span className="text-xs font-medium text-destructive">
                    ⚠️ Objeção mudou: {objectionLabels[client.objection_type || "none"]} → {objectionLabels[analysis.detected_objection]}
                  </span>
                </div>
              )}

              {/* Temperature change */}
              {analysis.temperature_changed && (
                <div className="bg-info/10 border border-info/20 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-info shrink-0" />
                  <span className="text-xs font-medium text-info">
                    🌡️ Temperatura mudou: {tempLabels[client.temperature]} → {tempLabels[analysis.detected_temperature]}
                  </span>
                </div>
              )}

              {/* Suggested message */}
              <div className="bg-secondary/50 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">💬 Como falar</p>
                <Textarea
                  value={editableMessage}
                  onChange={(e) => setEditableMessage(e.target.value)}
                  className="min-h-[80px] text-xs bg-background/50 resize-none"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {onSendWhatsApp && client.phone && (
                    <Button size="sm" className="h-7 rounded-full text-[10px] gap-1 flex-1" onClick={() => onSendWhatsApp(editableMessage)}>
                      <MessageCircle className="w-2.5 h-2.5" /> WhatsApp
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px] gap-1" onClick={copyMsg}>
                    <Copy className="w-2.5 h-2.5" /> Copiar
                  </Button>
                </div>

                {/* Tone variations */}
                <div className="flex gap-1.5 pt-1">
                  <p className="text-[9px] text-muted-foreground self-center mr-1">Tom:</p>
                  {(["suave", "direto", "forte"] as const).map(tone => (
                    <Button
                      key={tone}
                      size="sm"
                      variant="ghost"
                      className="h-6 rounded-full text-[9px] px-2"
                      disabled={isLoading || regenCount >= MAX_REGENERATIONS}
                      onClick={() => regenerateMessage(tone)}
                    >
                      {tone === "suave" ? "🕊️" : tone === "direto" ? "🎯" : "💥"} {tone.charAt(0).toUpperCase() + tone.slice(1)}
                    </Button>
                  ))}
                  {regenCount > 0 && (
                    <span className="text-[9px] text-muted-foreground self-center ml-auto">
                      {regenCount}/{MAX_REGENERATIONS}
                    </span>
                  )}
                </div>
              </div>

              {/* Apply changes button */}
              {!changesApplied ? (
                <Button
                  onClick={applyChanges}
                  className="w-full gap-2 rounded-xl"
                  size="sm"
                  variant="outline"
                  disabled={updateClient.isPending}
                >
                  <Check className="w-3.5 h-3.5" /> Aplicar mudanças no lead
                </Button>
              ) : (
                <div className="text-center text-xs text-green-600 font-medium py-1">
                  ✅ Mudanças aplicadas com sucesso
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WhatsAppAnalyzer;
