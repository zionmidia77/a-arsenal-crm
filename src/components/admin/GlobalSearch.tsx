import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, User, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const tempEmoji: Record<string, string> = { hot: "🔥", warm: "🟡", cold: "🔵", frozen: "⚪" };

const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("clients")
        .select("id, name, phone, temperature, interest, pipeline_stage")
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%,interest.ilike.%${query}%`)
        .limit(8);
      setResults(data || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const selectClient = (id: string) => {
    navigate(`/admin/client/${id}`);
    setOpen(false);
    setQuery("");
  };

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-border/50 text-xs text-muted-foreground hover:border-primary/30 transition-colors">
        <Search className="w-3 h-3" />
        <span className="hidden sm:inline">Buscar cliente...</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-xl">
      <div className="max-w-md mx-auto pt-16 px-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Nome, telefone ou interesse..."
            className="pl-9 pr-9 rounded-xl bg-secondary border-border/50 h-12 text-base"
            autoFocus
          />
          <button onClick={() => { setOpen(false); setQuery(""); }} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="mt-3 space-y-1">
          {loading && <p className="text-xs text-muted-foreground text-center py-4">Buscando...</p>}
          {!loading && query && results.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum resultado</p>
          )}
          {results.map(c => (
            <button
              key={c.id}
              onClick={() => selectClient(c.id)}
              className="w-full flex items-center gap-3 px-4 py-3 glass-card-hover text-left"
            >
              <span className="text-base">{tempEmoji[c.temperature] || "⚪"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">{c.interest || "Sem interesse"} · {c.phone || "Sem tel"}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
