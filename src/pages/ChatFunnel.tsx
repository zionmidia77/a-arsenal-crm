import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, ArrowLeft, Bike } from "lucide-react";

interface Message {
  id: number;
  text: string;
  sender: "bot" | "user";
  options?: string[];
  inputType?: "text" | "phone";
}

const FLOW: Omit<Message, "id" | "sender">[] = [
  { text: "Fala! 👊 Eu sou o Consultor Arsenal. Bora ver o que a gente pode fazer por você?" },
  { text: "Pra começar, o que te trouxe aqui?", options: ["Quero comprar uma moto", "Quero trocar minha moto", "Quero vender minha moto", "Só tô dando uma olhada"] },
  { text: "Boa, já entendi 👌 Qual faixa de valor você tá pensando?", options: ["Até R$ 15 mil", "R$ 15 a 30 mil", "R$ 30 a 50 mil", "Acima de R$ 50 mil"] },
  { text: "Show! E você tem moto pra dar na troca?", options: ["Sim, tenho", "Não tenho"] },
  { text: "Perfeito! Me diz seu nome pra eu te chamar direito 😄", inputType: "text" },
  { text: "E qual seu WhatsApp? Prometo que não vou lotar sua caixa 😅", inputType: "phone" },
  { text: "Pronto! Vou preparar as melhores opções pra você. Um especialista Arsenal vai te chamar em breve 🔥" },
];

const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    className="flex items-end gap-2.5 mb-4"
  >
    <Avatar className="h-8 w-8 border border-primary/30">
      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">A</AvatarFallback>
    </Avatar>
    <div className="glass-card px-4 py-3.5 flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-2 h-2 rounded-full bg-muted-foreground animate-typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  </motion.div>
);

const ChatFunnel = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
  }, []);

  const sendBotMessage = useCallback((stepIdx: number) => {
    if (stepIdx >= FLOW.length) return;
    setTyping(true);
    scrollToBottom();
    setTimeout(() => {
      setTyping(false);
      const flowItem = FLOW[stepIdx];
      setMessages((prev) => [...prev, { id: Date.now(), sender: "bot", ...flowItem }]);
      scrollToBottom();
    }, 1000 + Math.random() * 600);
  }, [scrollToBottom]);

  useEffect(() => {
    sendBotMessage(0);
  }, []);

  const handleAnswer = (answer: string) => {
    setMessages((prev) => [...prev, { id: Date.now(), sender: "user", text: answer }]);
    const nextStep = step + 1;
    setStep(nextStep);
    scrollToBottom();
    if (nextStep >= FLOW.length) {
      setTimeout(() => navigate("/dashboard"), 2500);
    } else {
      sendBotMessage(nextStep);
    }
  };

  const handleSubmitInput = () => {
    if (!inputValue.trim()) return;
    handleAnswer(inputValue.trim());
    setInputValue("");
  };

  const currentBotMsg = messages.filter((m) => m.sender === "bot").slice(-1)[0];
  const progress = Math.min(((step) / (FLOW.length - 1)) * 100, 100);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 backdrop-blur-xl bg-background/80 sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-10 w-10 border-2 border-primary/40 glow-red">
          <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
            <Bike className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-foreground text-sm">Consultor Arsenal</p>
          <p className="text-xs text-success flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success inline-block animate-pulse" />
            online agora
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-secondary">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={`flex mb-3 ${msg.sender === "user" ? "justify-end" : "items-end gap-2.5"}`}
            >
              {msg.sender === "bot" && (
                <Avatar className="h-8 w-8 border border-primary/30 shrink-0">
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">A</AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[80%] ${msg.sender === "user"
                ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5"
                : "glass-card px-4 py-3"
              }`}>
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {typing && <TypingIndicator />}
        </AnimatePresence>

        {/* Options */}
        <AnimatePresence>
          {!typing && currentBotMsg?.options && step < FLOW.length && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap gap-2 pt-2 pl-10"
            >
              {currentBotMsg.options.map((opt, i) => (
                <motion.div
                  key={opt}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Button
                    variant="outline"
                    onClick={() => handleAnswer(opt)}
                    className="rounded-full border-primary/30 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:glow-red transition-all text-sm h-auto py-2.5 px-4"
                  >
                    {opt}
                  </Button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <AnimatePresence>
        {!typing && currentBotMsg?.inputType && step < FLOW.length && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="px-4 py-3 border-t border-border/50 bg-background/80 backdrop-blur-xl"
          >
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmitInput()}
                placeholder={currentBotMsg.inputType === "phone" ? "(00) 00000-0000" : "Digite aqui..."}
                className="rounded-full bg-secondary border-border/50 h-11"
                autoFocus
              />
              <Button size="icon" onClick={handleSubmitInput} className="rounded-full shrink-0 h-11 w-11 glow-red">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatFunnel;
