import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const COPILOT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`;

interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

export const useLeadCopilot = (clientId: string) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const qc = useQueryClient();

  const sendMessage = useCallback(async (input: string) => {
    const userMsg: CopilotMessage = { role: "user", content: input };
    const allMessages = [...messages, userMsg];
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(COPILOT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ client_id: clientId, messages: allMessages }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

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
            if (content) upsertAssistant(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      // Refresh memory after response
      qc.invalidateQueries({ queryKey: ["lead-memory", clientId] });
      qc.invalidateQueries({ queryKey: ["lead-timeline", clientId] });
    } catch (e) {
      console.error("Copilot error:", e);
      upsertAssistant("Erro ao processar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [messages, clientId, qc]);

  const pasteWhatsApp = useCallback(async (conversation: string) => {
    setIsLoading(true);
    setMessages(prev => [...prev, { role: "user", content: `📋 Conversa WhatsApp colada (${conversation.length} chars)` }]);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(COPILOT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ client_id: clientId, whatsapp_paste: conversation }),
      });

      if (!resp.ok || !resp.body) throw new Error("Failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

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
            if (content) upsertAssistant(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["lead-memory", clientId] });
      qc.invalidateQueries({ queryKey: ["lead-timeline", clientId] });
    } catch (e) {
      console.error("WhatsApp paste error:", e);
      upsertAssistant("Erro ao analisar conversa. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [clientId, qc]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, pasteWhatsApp, clearMessages };
};

// Hook to fetch lead memory
export const useLeadMemory = (clientId: string) => {
  return useQuery({
    queryKey: ["lead-memory", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_memory")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
};

// Hook to fetch lead timeline
export const useLeadTimeline = (clientId: string) => {
  return useQuery({
    queryKey: ["lead-timeline", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_timeline_events")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
};
