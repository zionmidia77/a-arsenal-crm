import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ArrowLeft, Sparkles, UserCheck, Camera, FileCheck, Loader2, Car, ChevronLeft, ChevronRight, RotateCcw, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import consultantAvatar from "@/assets/consultant-avatar.png";

// ── Types ──
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  vehicles?: StockVehicle[];
  photos?: string[];
  thumbnail?: string;
}

interface StockVehicle {
  brand: string;
  model: string;
  year?: number;
  km?: number;
  color?: string;
  price: number;
  condition: string;
  description?: string;
  features?: string[];
  photos?: string[];
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
      <AvatarImage src={consultantAvatar} alt="Consultor" />
      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">L</AvatarFallback>
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

// ── Notification sound ──
const playNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.08);
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.25);
  } catch {}
};

// ── Read receipts ──
const ReadReceipt = ({ read }: { read: boolean }) => (
  <span className={`inline-flex ml-1 ${read ? "text-blue-400" : "text-primary-foreground/40"}`}>
    <svg viewBox="0 0 16 10" className="w-4 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 5.5L4 8.5L10 1.5" />
      <path d="M5 5.5L8 8.5L14 1.5" />
    </svg>
  </span>
);

// ── Chat Bubble ──
const ChatBubble = ({ msg, isRead }: { msg: ChatMessage; isRead?: boolean }) => {
  const isUser = msg.role === "user";
  const isPhotoOnly = !isUser && msg.photos && msg.photos.length > 0 && !msg.content;
  const isDocUpload = isUser && msg.content.startsWith("📷");
  const time = msg.timestamp.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Photo-only message (individual photo sent by AI)
  if (isPhotoOnly) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex mb-3 items-end gap-2.5"
      >
        <Avatar className="h-8 w-8 border border-primary/30 shrink-0">
          <AvatarImage src={consultantAvatar} alt="Consultor" />
          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">L</AvatarFallback>
        </Avatar>
        <div className="max-w-[82%] rounded-2xl rounded-bl-sm overflow-hidden border border-border/40">
          <img
            src={msg.photos![0]}
            alt="Foto do veículo"
            className="w-full max-w-[300px] h-auto rounded-2xl rounded-bl-sm object-cover"
            loading="lazy"
          />
          <p className="text-[10px] text-muted-foreground px-3 py-1 bg-card/80">{time}</p>
        </div>
      </motion.div>
    );
  }

  // Document upload with thumbnail preview
  if (isDocUpload && msg.thumbnail) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex mb-3 justify-end"
      >
        <div className="max-w-[82%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm overflow-hidden">
          <img
            src={msg.thumbnail}
            alt="Documento enviado"
            className="w-full max-w-[250px] h-auto max-h-[200px] object-cover"
          />
          <div className="px-4 py-2">
            <p className="text-sm leading-relaxed">{msg.content}</p>
            <p className="text-[10px] text-primary-foreground/50 text-right mt-1 flex items-center justify-end gap-0.5">
              {time}
              {isRead !== undefined && <ReadReceipt read={!!isRead} />}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`flex mb-3 ${isUser ? "justify-end" : "items-end gap-2.5"}`}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 border border-primary/30 shrink-0">
          <AvatarImage src={consultantAvatar} alt="Consultor" />
          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">L</AvatarFallback>
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
            <ReactMarkdown
              components={{
                a: ({ href, children }) => {
                  const isWhatsApp = href?.includes("wa.me");
                  if (isWhatsApp) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-underline inline-flex items-center gap-2 mt-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-600/20"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.118.56 4.1 1.53 5.82L0 24l6.34-1.66A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.92 0-3.75-.52-5.35-1.46l-.38-.23-3.97 1.04 1.06-3.87-.25-.4A9.8 9.8 0 012.18 12c0-5.42 4.4-9.82 9.82-9.82S21.82 6.58 21.82 12 17.42 21.82 12 21.82z"/></svg>
                        {children}
                      </a>
                    );
                  }
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      {children}
                    </a>
                  );
                },
              }}
            >{msg.content}</ReactMarkdown>
          </div>
        )}
        <p
          className={`text-[10px] mt-1 flex items-center ${
            isUser ? "text-primary-foreground/50 justify-end gap-0.5" : "text-muted-foreground"
          }`}
        >
          {time}
          {isUser && isRead !== undefined && <ReadReceipt read={!!isRead} />}
        </p>
      </div>
    </motion.div>
  );
};

// ── Quick suggestion chips ──
const SuggestionChips = ({ onSelect }: { onSelect: (text: string) => void }) => {
  const suggestions = [
    "Quero comprar um veículo",
    "Quero trocar meu veículo",
    "Quero vender meu veículo",
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

// ── Vehicle Card ──
const VehicleCard = ({ vehicle }: { vehicle: StockVehicle }) => {
  const [photoIdx, setPhotoIdx] = useState(0);
  const photos = vehicle.photos || [];
  const hasPhotos = photos.length > 0;

  return (
    <div className="min-w-[220px] max-w-[240px] rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden shrink-0 snap-center">
      <div className="relative h-32 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden">
        {hasPhotos ? (
          <>
            <img src={photos[photoIdx]} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full h-full object-cover" />
            {photos.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => (i > 0 ? i - 1 : photos.length - 1)); }}
                  className="absolute left-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => (i < photos.length - 1 ? i + 1 : 0)); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {photos.map((_, i) => (
                    <span key={i} className={`w-1 h-1 rounded-full ${i === photoIdx ? "bg-white" : "bg-white/50"}`} />
                  ))}
                </div>
                <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-black/50 text-white text-[9px] flex items-center gap-0.5">
                  <Camera className="h-2.5 w-2.5" /> {photos.length}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Car className="w-12 h-12 text-primary/60" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <h4 className="font-semibold text-sm text-foreground leading-tight">
          {vehicle.brand} {vehicle.model}
        </h4>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {vehicle.year && <span>{vehicle.year}</span>}
          {vehicle.km != null && <span>• {vehicle.km.toLocaleString("pt-BR")} km</span>}
          {vehicle.color && <span>• {vehicle.color}</span>}
        </div>
        <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
          {vehicle.condition}
        </span>
        <p className="text-base font-bold text-primary">
          R$ {Number(vehicle.price).toLocaleString("pt-BR")}
        </p>
        {vehicle.features && vehicle.features.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {vehicle.features.slice(0, 3).map((f, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-accent/50 text-accent-foreground">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Vehicle Carousel ──
const VehicleCarousel = ({ vehicles }: { vehicles: StockVehicle[] }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    scrollContainerRef.current?.scrollBy({
      left: direction === "left" ? -240 : 240,
      behavior: "smooth",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 pl-10"
    >
      <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
        <Car className="w-3.5 h-3.5 text-primary" />
        <span className="font-medium">Veículos do estoque</span>
        <span>• {vehicles.length} opções</span>
      </div>
      <div className="relative">
        {vehicles.length > 2 && (
          <>
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 border border-border/50 flex items-center justify-center shadow-sm hover:bg-accent transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 border border-border/50 flex items-center justify-center shadow-sm hover:bg-accent transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 px-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {vehicles.map((v, i) => (
            <VehicleCard key={`${v.brand}-${v.model}-${i}`} vehicle={v} />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// ── "Last seen" helper ──
const useLastSeen = () => {
  const [lastSeen, setLastSeen] = useState<string>("online agora");
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Simulate realistic "last seen" behavior
    const interval = setInterval(() => {
      const rand = Math.random();
      if (rand > 0.92) {
        setIsOnline(false);
        setLastSeen("visto por último às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
        setTimeout(() => {
          setIsOnline(true);
          setLastSeen("online agora");
        }, 3000 + Math.random() * 5000);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return { lastSeen, isOnline };
};

// ── Main Component ──
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const STORAGE_KEY = "arsenal-chat-session-id";

const getOrCreateSessionId = (): string => {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const newId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, newId);
    return newId;
  } catch {
    return crypto.randomUUID();
  }
};

const ChatFunnel = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [sessionId, setSessionId] = useState(getOrCreateSessionId);
  const [conversationSaved, setConversationSaved] = useState(false);
  const [isTransferred, setIsTransferred] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);
  const [pendingVehicles, setPendingVehicles] = useState<StockVehicle[] | null>(null);
  const pendingVehiclesRef = useRef<StockVehicle[] | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<string[] | null>(null);
  const pendingPhotosRef = useRef<string[] | null>(null);
  const [isRestoringChat, setIsRestoringChat] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { lastSeen, isOnline } = useLastSeen();

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

  // Save conversation to DB
  const saveConversation = useCallback(async (msgs: ChatMessage[], cId?: string | null, status = "active") => {
    const serialized = msgs.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.toISOString(),
    }));

    try {
      const { data: existing } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("chat_conversations")
          .update({
            messages: serialized as any,
            client_id: cId || clientId || null,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("chat_conversations")
          .insert({
            session_id: sessionId,
            messages: serialized as any,
            client_id: cId || clientId || null,
            status,
          });
        setConversationSaved(true);
      }
    } catch (err) {
      console.error("Error saving conversation:", err);
    }
  }, [sessionId, clientId]);

  // Start new conversation
  const startNewConversation = useCallback(() => {
    const newId = crypto.randomUUID();
    try { localStorage.setItem(STORAGE_KEY, newId); } catch {}
    setSessionId(newId);
    setClientId(null);
    setIsTransferred(false);
    setMessageCount(0);
    setShowSuggestions(true);
    setConversationSaved(false);
    const welcome: ChatMessage = {
      id: "welcome",
      role: "assistant",
      content:
            "E aí! Tudo bem? 👊\n\nAqui é o Lucas da Arsenal Motors. Tô aqui pra te ajudar, seja pra comprar, trocar ou o que precisar!\n\nMe conta, o que tá procurando?",
      timestamp: new Date(),
    };
    setMessages([welcome]);
  }, []);

  // Restore conversation from DB or show welcome
  useEffect(() => {
    const restoreChat = async () => {
      try {
        const { data } = await supabase
          .from("chat_conversations")
          .select("*")
          .eq("session_id", sessionId)
          .maybeSingle();

        if (data && Array.isArray(data.messages) && data.messages.length > 0) {
          const restored: ChatMessage[] = (data.messages as any[]).map((m, i) => ({
            id: `restored-${i}`,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.timestamp || data.created_at),
          }));
          setMessages(restored);
          setClientId(data.client_id || null);
          setIsTransferred(data.status === "transferred");
          setConversationSaved(true);
          setShowSuggestions(false);
          setMessageCount(restored.filter(m => m.role === "user").length);
          scrollToBottom();
        } else {
          // No existing conversation — show welcome
          const welcome: ChatMessage = {
            id: "welcome",
            role: "assistant",
            content:
              "E aí! Tudo bem? 👊\n\nAqui é o Lucas da Arsenal Motors. Tô aqui pra te ajudar, seja pra comprar, trocar ou o que precisar!\n\nMe conta, o que tá procurando?",
            timestamp: new Date(),
          };
          setMessages([welcome]);
        }
      } catch (err) {
        console.error("Error restoring chat:", err);
        const welcome: ChatMessage = {
          id: "welcome",
          role: "assistant",
          content:
            "E aí! Tudo bem? 👊\n\nAqui é o Lucas da Arsenal Motors. Tô aqui pra te ajudar, seja pra comprar, trocar ou o que precisar!\n\nMe conta, o que tá procurando?",
          timestamp: new Date(),
        };
        setMessages([welcome]);
      } finally {
        setIsRestoringChat(false);
      }
    };

    restoreChat();
  }, [sessionId, scrollToBottom]);

  // Realtime subscription — listen for admin replies
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_conversations',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          const newData = payload.new;
          if (!newData || !Array.isArray(newData.messages)) return;

          // Check if the last message is from admin (prefixed with [Vendedor])
          const dbMessages = newData.messages as any[];
          const lastDbMsg = dbMessages[dbMessages.length - 1];
          if (lastDbMsg?.role === 'assistant' && lastDbMsg?.content?.startsWith('[Vendedor]')) {
            // Add admin message to local state
            const adminMsg: ChatMessage = {
              id: `admin-${Date.now()}`,
              role: 'assistant',
              content: lastDbMsg.content.replace('[Vendedor] ', ''),
              timestamp: new Date(lastDbMsg.timestamp || new Date()),
            };

            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.content === adminMsg.content && m.role === 'assistant')) return prev;
              return [...prev, adminMsg];
            });
            playNotificationSound();
            scrollToBottom();
          }

          // Update transferred status
          if (newData.status === 'attended') {
            setIsTransferred(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, scrollToBottom]);


  // Handle transfer to human
  const handleTransfer = useCallback(async () => {
    setIsTransferred(true);
    const transferMsg: ChatMessage = {
      id: `system-${Date.now()}`,
      role: "assistant",
      content: "Entendi seu perfil! 🤝 Vou te transferir pro nosso especialista que vai finalizar tudo pra você. Ele já tem todas as informações da nossa conversa. Aguarde um momento...",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, transferMsg]);
    await saveConversation([...messages, transferMsg], clientId, "transferred");
    
    // Log interaction if we have a client
    if (clientId) {
      await supabase.from("interactions").insert({
        client_id: clientId,
        type: "system" as const,
        content: "Lead transferido do chat IA para atendente humano",
        created_by: "ai-consultant",
      });
    }
    
    toast.success("Conversa transferida para um especialista!");
    scrollToBottom();
  }, [messages, clientId, saveConversation, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || isTransferred) return;
      let latestClientId = clientId;

      setShowSuggestions(false);
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInputValue("");
      setIsLoading(true);
      setMessageCount(prev => prev + 1);
      scrollToBottom();

      // Build history for API
      const apiMessages = newMessages
        .filter((m) => m.id !== "welcome" || m.role === "user")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

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
              m.id === assistantId ? { ...m, content: assistantSoFar } : m
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

      // Delay variável para simular digitação humana (1-4 segundos)
      const humanDelay = 1000 + Math.random() * 3000;
      await new Promise(resolve => setTimeout(resolve, humanDelay));

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

              // Check for metadata event (client_id, vehicles)
              if (parsed.metadata) {
                if (parsed.metadata.client_id) {
                  const newClientId = parsed.metadata.client_id;
                  latestClientId = newClientId;
                  setClientId(newClientId);
                  saveConversation(newMessages, newClientId);
                }
                if (parsed.metadata.vehicles?.length) {
                  setPendingVehicles(parsed.metadata.vehicles);
                  pendingVehiclesRef.current = parsed.metadata.vehicles;
                }
                if (parsed.metadata.individual_photos?.length) {
                  setPendingPhotos(parsed.metadata.individual_photos);
                  pendingPhotosRef.current = parsed.metadata.individual_photos;
                }
                continue;
              }

              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
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
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) upsertAssistant(content);
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e) {
        console.error("Chat error:", e);
        if (!assistantSoFar) {
          upsertAssistant("Ops, tive um probleminha aqui. Pode mandar de novo? 😅");
        }
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
        playNotificationSound();

        // Attach pending vehicles to the last assistant message
        const vehiclesToAttach = pendingVehiclesRef.current;
        const photosToAttach = pendingPhotosRef.current;
        setMessages(prev => {
          let updated = [...prev];

          // Attach vehicles to last assistant message
          if (vehiclesToAttach && vehiclesToAttach.length > 0) {
            updated = updated.map((m, i) =>
              i === updated.length - 1 && m.role === "assistant"
                ? { ...m, vehicles: vehiclesToAttach }
                : m
            );
            setPendingVehicles(null);
            pendingVehiclesRef.current = null;
          }

          // Add individual photos as separate messages after the assistant text
          if (photosToAttach && photosToAttach.length > 0) {
            const photoMessages: ChatMessage[] = photosToAttach.map((url, i) => ({
              id: `photo-${Date.now()}-${i}`,
              role: "assistant" as const,
              content: "",
              timestamp: new Date(),
              photos: [url],
            }));
            updated = [...updated, ...photoMessages];
            setPendingPhotos(null);
            pendingPhotosRef.current = null;
          }

          saveConversation(updated, latestClientId);
          return updated;
        });
      }
    },
    [messages, isLoading, isTransferred, clientId, scrollToBottom, saveConversation]
  );

  // Auto-send message when coming from catalog with ?veiculo= param
  const vehicleParamSent = useRef(false);
  useEffect(() => {
    if (vehicleParamSent.current || isRestoringChat || isLoading) return;
    const vehicleName = searchParams.get("veiculo") || searchParams.get("moto");
    if (vehicleName && messages.length >= 1 && !messages.some(m => m.role === "user")) {
      vehicleParamSent.current = true;
      sendMessage(`Tenho interesse no ${vehicleName.trim()}`);
    }
  }, [isRestoringChat, isLoading, searchParams, messages, sendMessage]);

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

  // Document photo handler
  const handleDocumentUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isLoading || isTransferred) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!file.type.startsWith("image/")) {
      toast.error("Envie apenas fotos/imagens");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 10MB)");
      return;
    }

    setIsAnalyzingDoc(true);

    // Generate thumbnail for preview
    const thumbnailUrl = URL.createObjectURL(file);

    const userMsg: ChatMessage = {
      id: `user-doc-${Date.now()}`,
      role: "user",
      content: "📷 Enviei um documento para análise",
      timestamp: new Date(),
      thumbnail: thumbnailUrl,
    };
    setMessages(prev => [...prev, userMsg]);
    setMessageCount(prev => prev + 1);
    scrollToBottom();

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ image_base64: base64, client_id: clientId }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao analisar documento");
      }

      const result = await resp.json();
      const docLabels: Record<string, string> = {
        cnh: "CNH (Carteira de Habilitação)",
        income_proof: "Comprovante de Renda",
        address_proof: "Comprovante de Residência",
        identity: "Documento de Identidade",
      };

      let responseContent = "";

      if (result.document_type === "not_document") {
        responseContent = "Hmm, isso não parece ser um documento. 🤔 Manda a foto da sua **CNH**, **holerite** ou **comprovante de residência** que eu analiso rapidinho!";
      } else {
        const label = docLabels[result.document_type] || "Documento";
        responseContent = `✅ **${label}** recebido e analisado!\n\n`;
        responseContent += `${result.summary || ""}\n\n`;

        if (result.extracted_data) {
          const ext = result.extracted_data;
          const details: string[] = [];
          if (ext.full_name) details.push(`👤 **Nome:** ${ext.full_name}`);
          if (ext.cpf) details.push(`🔢 **CPF:** ${ext.cpf}`);
          if (ext.cnh_number) details.push(`🪪 **CNH:** ${ext.cnh_number}`);
          if (ext.cnh_category) details.push(`📋 **Categoria:** ${ext.cnh_category}`);
          if (ext.cnh_expiry) details.push(`📅 **Validade:** ${ext.cnh_expiry}`);
          if (ext.employer) details.push(`🏢 **Empregador:** ${ext.employer}`);
          if (ext.position) details.push(`💼 **Cargo:** ${ext.position}`);
          if (ext.salary) details.push(`💰 **Salário:** R$ ${Number(ext.salary).toLocaleString("pt-BR")}`);
          if (ext.city) details.push(`📍 **Cidade:** ${ext.city}`);
          if (details.length > 0) responseContent += details.join("\n") + "\n\n";
        }

        if (result.issues?.length > 0) {
          responseContent += `⚠️ **Atenção:** ${result.issues.join(", ")}\n\n`;
        }

        if (result.document_type === "cnh") {
          responseContent += "Agora manda seu **comprovante de renda** (holerite ou contracheque) pra eu adiantar a análise de crédito! 📋";
        } else if (result.document_type === "income_proof") {
          responseContent += "Massa! Agora só falta o **comprovante de residência** e ficamos prontos! 🏠";
        } else if (result.document_type === "address_proof") {
          responseContent += "Perfeito! Documentação ficando completa! 🎯";
        }

        if (clientId) {
          const { data: client } = await supabase
            .from("clients")
            .select("financing_docs")
            .eq("id", clientId)
            .maybeSingle();
          const docs = client?.financing_docs as Record<string, boolean> | null;
          if (docs?.cnh && docs?.pay_stub && docs?.proof_of_residence) {
            responseContent += "\n\n🎉 **Documentação completa!** Vou encaminhar pra análise de crédito!";
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-doc-${Date.now()}`,
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setMessages(prev => { saveConversation(prev); return prev; });
      playNotificationSound();
    } catch (err) {
      console.error("Document analysis error:", err);
      const errorMsg: ChatMessage = {
        id: `assistant-doc-err-${Date.now()}`,
        role: "assistant",
        content: "Ops, não consegui analisar esse documento agora. Tenta de novo com uma foto mais nítida! 📸",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
      toast.error("Erro ao analisar documento");
    } finally {
      setIsAnalyzingDoc(false);
      scrollToBottom();
    }
  }, [clientId, isLoading, isTransferred, scrollToBottom, saveConversation]);

  // Audio recording using Web Speech API
  const startRecording = useCallback(async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta reconhecimento de voz. Use o Chrome.");
      return;
    }

    try {
      // Request mic permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());

      const recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let finalTranscript = "";

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + " ";
          }
        }
      };

      recognition.onend = () => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setRecordingDuration(0);
        setIsRecording(false);

        const text = finalTranscript.trim();
        if (text) {
          sendMessage(text);
        } else {
          toast.error("Não consegui entender o áudio. Tente novamente.");
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          toast.error("Permita o acesso ao microfone para enviar áudios");
        } else if (event.error !== "aborted") {
          toast.error("Erro no reconhecimento de voz. Tente novamente.");
        }
        setIsRecording(false);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setRecordingDuration(0);
      };

      mediaRecorderRef.current = recognition as any;
      recognition.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch (err) {
      console.error("Mic error:", err);
      toast.error("Permita o acesso ao microfone para enviar áudios");
    }
  }, [sendMessage]);



  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      try { (mediaRecorderRef.current as any).stop(); } catch {}
    }
    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      try { (mediaRecorderRef.current as any).abort(); } catch {}
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Show transfer button after 4+ user messages (lead likely qualified)
  const showTransferButton = messageCount >= 4 && !isTransferred;

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
        <div className="relative">
          <Avatar className="h-10 w-10 border-2 border-primary/40 glow-red">
            <AvatarImage src={consultantAvatar} alt="Consultor Arsenal" />
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">L</AvatarFallback>
          </Avatar>
          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${isOnline ? "bg-emerald-500" : "bg-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-foreground text-sm">
            Lucas — Arsenal Motors
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                online agora
              </>
            ) : (
              lastSeen
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* New conversation button */}
          {!isRestoringChat && messages.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={startNewConversation}
              className="rounded-full h-8 w-8 text-muted-foreground hover:text-primary"
              title="Nova conversa"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
          {showTransferButton && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTransfer}
                className="text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Falar com humano
              </Button>
            </motion.div>
          )}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-full">
            <Sparkles className="w-3 h-3 text-primary" />
            IA
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {isRestoringChat ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando conversa...</p>
          </div>
        ) : (
          <>
            {/* Restored conversation indicator */}
            {conversationSaved && messages.length > 1 && messages[0]?.id?.startsWith("restored") && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center mb-4"
              >
                <div className="bg-secondary/80 text-muted-foreground text-[10px] px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-border/50">
                  <RotateCcw className="w-3 h-3" />
                  Conversa anterior restaurada
                </div>
              </motion.div>
            )}

            <AnimatePresence mode="popLayout">
              {messages.map((msg, idx) => {
                // User messages are "read" if there's a subsequent assistant message
                const isRead = msg.role === "user"
                  ? messages.slice(idx + 1).some(m => m.role === "assistant")
                  : undefined;
                return (
                  <div key={msg.id}>
                    <ChatBubble msg={msg} isRead={isRead} />
                    {msg.vehicles && msg.vehicles.length > 0 && (
                      <VehicleCarousel vehicles={msg.vehicles} />
                    )}
                  </div>
                );
              })}
            </AnimatePresence>
          </>
        )}

        <AnimatePresence>{isLoading && <TypingIndicator />}</AnimatePresence>

        {showSuggestions && messages.length === 1 && !isLoading && !isRestoringChat && (
          <SuggestionChips onSelect={handleSuggestion} />
        )}

        {isTransferred && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center my-4"
          >
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-2 rounded-full flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5" />
              Transferido para especialista
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border/50 bg-background/80 backdrop-blur-xl">
        {isTransferred ? (
          <div className="text-center text-sm text-muted-foreground py-2">
            Conversa transferida. Um especialista entrará em contato em breve.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleDocumentUpload}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isLoading || isAnalyzingDoc || isRecording || isTranscribing}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full shrink-0 h-11 w-11 text-muted-foreground hover:text-primary transition-colors"
              title="Enviar documento (CNH, holerite, comprovante)"
            >
              {isAnalyzingDoc ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>

            {isRecording ? (
              <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-destructive/10 border border-destructive/30">
                <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse shrink-0" />
                <span className="text-sm font-medium text-destructive flex-1">
                  Gravando... {formatDuration(recordingDuration)}
                </span>
                <button type="button" onClick={cancelRecording} className="text-xs text-muted-foreground hover:text-foreground transition px-2">
                  Cancelar
                </button>
              </div>
            ) : isTranscribing ? (
              <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary border border-border/50">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Transcrevendo áudio...</span>
              </div>
            ) : (
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={isAnalyzingDoc ? "Analisando documento..." : "Digite ou envie um áudio..."}
                  rows={1}
                  disabled={isLoading || isAnalyzingDoc}
                  className="w-full resize-none rounded-2xl bg-secondary border border-border/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50 placeholder:text-muted-foreground"
                  style={{ maxHeight: "120px" }}
                />
              </div>
            )}

            {isRecording ? (
              <Button
                type="button"
                size="icon"
                onClick={stopRecording}
                className="rounded-full shrink-0 h-11 w-11 bg-destructive hover:bg-destructive/90 transition-all"
              >
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : inputValue.trim() ? (
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || isAnalyzingDoc || isTranscribing}
                className="rounded-full shrink-0 h-11 w-11 glow-red transition-all"
              >
                <Send className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                disabled={isLoading || isAnalyzingDoc || isTranscribing}
                onClick={startRecording}
                className="rounded-full shrink-0 h-11 w-11 bg-primary/80 hover:bg-primary transition-all"
                title="Gravar áudio"
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
          </form>
        )}
        <p className="text-[9px] text-muted-foreground text-center mt-2 opacity-50">
          Arsenal Motors · Atendimento inteligente
        </p>
      </div>

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
