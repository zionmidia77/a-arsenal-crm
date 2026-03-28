import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, ArrowLeft, Bike, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

// ── Types ──
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// ── Typing indicator ──
const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    className="flex items-end gap-2.5 mb-4"
  >
    <Avatar className="h-8 w-8 border border-primary/30 shrink-0">
      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
        <Bike className="w-3.5 h-3.5" />
      </AvatarFallback>
    </Avatar>
    <div className="glass-card px-4 py-3.5 flex gap-1.5 rounded-2xl rounded-bl-sm">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-muted-foreground"
          style={{
            animation: "typing-bounce 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  </motion.div>
);

// ── Chat Bubble ──
const ChatBubble = ({ msg }: { msg: ChatMessage }) => {
  const isUser = msg.role === "user";
  const time = msg.timestamp.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`flex mb-3 ${isUser ? "justify-end" : "items-end gap-2.5"}`}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 border border-primary/30 shrink-0">
          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
            <Bike className="w-3.5 h-3.5" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={`max-w-[82%] ${
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5"
            : "glass-card px-4 py-3 rounded-2xl rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none [&_p]:mb-1 [&_p:last-child]:mb-0">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
        <p
          className={`text-[10px] mt-1 ${
            isUser ? "text-primary-foreground/50 text-right" : "text-muted-foreground"
          }`}
        >
          {time}
        </p>
      </div>
    </motion.div>
  );
};

// ── Quick suggestion chips ──
const SuggestionChips = ({ onSelect }: { onSelect: (text: string) => void }) => {
  const suggestions = [
    "Quero comprar uma moto",
    "Quero trocar minha moto",
    "Quero vender minha moto",
    "Preciso de dinheiro",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="flex flex-wrap gap-2 px-4 pb-3 pl-12"
    >
      {suggestions.map((s, i) => (
        <motion.button
          key={s}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 + i * 0.08 }}
          onClick={() => onSelect(s)}
          className="text-xs px-3.5 py-2 rounded-full border border-primary/30 text-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200"
        >
          {s}
        </motion.button>
      ))}
    </motion.div>
  );
};

// ── Main Component ──
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const ChatFunnel = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(
      () =>
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        }),
      100
    );
  }, []);

  // Send welcome message on mount
  useEffect(() => {
    const welcome: ChatMessage = {
      id: "welcome",
      role: "assistant",
      content:
        "E aí! Tudo bem? 👊\n\nSou o consultor da Arsenal Motors. Tô aqui pra te ajudar a encontrar a moto perfeita, fazer uma troca ou o que precisar!\n\nComo posso te ajudar?",
      timestamp: new Date(),
    };
    setMessages([welcome]);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      setShowSuggestions(false);
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputValue("");
      setIsLoading(true);
      scrollToBottom();

      // Build history for API (exclude welcome if it's the static one)
      const apiMessages = [...messages, userMsg]
        .filter((m) => m.id !== "welcome" || m.role === "user")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      // Include the welcome as an assistant message for context
      if (messages[0]?.id === "welcome") {
        apiMessages.unshift({
          role: "assistant",
          content: messages[0].content,
        });
      }

      let assistantSoFar = "";
      const assistantId = `assistant-${Date.now()}`;

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === assistantId) {
            return prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: assistantSoFar }
                : m
            );
          }
          return [
            ...prev,
            {
              id: assistantId,
              role: "assistant" as const,
              content: assistantSoFar,
              timestamp: new Date(),
            },
          ];
        });
        scrollToBottom();
      };

      try {
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: apiMessages,
            context: clientId ? { clientId } : undefined,
          }),
        });

        if (!resp.ok || !resp.body) {
          const errorData = await resp.json().catch(() => ({}));
          if (resp.status === 429) {
            toast.error("Muitas mensagens! Aguarde um momento.");
          } else if (resp.status === 402) {
            toast.error("Serviço temporariamente indisponível.");
          } else {
            toast.error(errorData.error || "Erro ao enviar mensagem");
          }
          throw new Error(errorData.error || "Failed");
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as
                | string
                | undefined;
              if (content) upsertAssistant(content);
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Flush remaining buffer
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as
                | string
                | undefined;
              if (content) upsertAssistant(content);
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e) {
        console.error("Chat error:", e);
        if (!assistantSoFar) {
          upsertAssistant(
            "Ops, tive um probleminha aqui. Pode mandar de novo? 😅"
          );
        }
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [messages, isLoading, clientId, scrollToBottom]
  );

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestion = (text: string) => {
    sendMessage(text);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 backdrop-blur-xl bg-background/80 sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-10 w-10 border-2 border-primary/40 glow-red">
          <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
            <Bike className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-foreground text-sm">
            Consultor Arsenal
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            online agora
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-full">
          <Sparkles className="w-3 h-3 text-primary" />
          IA
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} />
          ))}
        </AnimatePresence>

        <AnimatePresence>{isLoading && <TypingIndicator />}</AnimatePresence>

        {/* Suggestion chips after welcome */}
        {showSuggestions && messages.length === 1 && !isLoading && (
          <SuggestionChips onSelect={handleSuggestion} />
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border/50 bg-background/80 backdrop-blur-xl">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Auto-resize
                e.target.style.height = "auto";
                e.target.style.height =
                  Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-2xl bg-secondary border border-border/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50 placeholder:text-muted-foreground"
              style={{ maxHeight: "120px" }}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!inputValue.trim() || isLoading}
            className="rounded-full shrink-0 h-11 w-11 glow-red transition-all"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>

        <p className="text-[9px] text-muted-foreground text-center mt-2 opacity-50">
          Arsenal Motors · Atendimento inteligente
        </p>
      </div>

      {/* CSS for typing animation */}
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ChatFunnel;
