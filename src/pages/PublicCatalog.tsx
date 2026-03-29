import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Bike, MessageCircle, Filter, ChevronLeft, ChevronRight, X, ZoomIn, Camera, GitCompareArrows, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// ── Lightbox with carousel + zoom ──
const PhotoLightbox = ({
  photos,
  initialIndex,
  open,
  onClose,
}: {
  photos: string[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  const prev = useCallback(() => { setIndex(i => (i > 0 ? i - 1 : photos.length - 1)); setZoomed(false); }, [photos.length]);
  const next = useCallback(() => { setIndex(i => (i < photos.length - 1 ? i + 1 : 0)); setZoomed(false); }, [photos.length]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/95 overflow-hidden">
        <div className="relative w-full h-[85vh] flex items-center justify-center">
          {/* Close */}
          <button onClick={onClose} className="absolute top-3 right-3 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition">
            <X className="h-5 w-5" />
          </button>

          {/* Counter */}
          <div className="absolute top-3 left-3 z-50 px-3 py-1 rounded-full bg-black/50 text-white text-sm flex items-center gap-1">
            <Camera className="h-3.5 w-3.5" /> {index + 1}/{photos.length}
          </div>

          {/* Prev */}
          {photos.length > 1 && (
            <button onClick={prev} className="absolute left-2 z-40 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition">
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Image */}
          <AnimatePresence mode="wait">
            <motion.img
              key={photos[index]}
              src={photos[index]}
              alt={`Foto ${index + 1}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`max-h-full max-w-full object-contain cursor-pointer transition-transform duration-300 ${zoomed ? "scale-150" : ""}`}
              onClick={() => setZoomed(z => !z)}
            />
          </AnimatePresence>

          {/* Next */}
          {photos.length > 1 && (
            <button onClick={next} className="absolute right-2 z-40 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition">
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Zoom hint */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-black/50 text-white/70 text-xs">
            <ZoomIn className="h-3 w-3" /> Clique para {zoomed ? "reduzir" : "ampliar"}
          </div>

          {/* Thumbnails */}
          {photos.length > 1 && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[80vw] overflow-x-auto p-1">
              {photos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => { setIndex(i); setZoomed(false); }}
                  className={`flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition ${i === index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
                >
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Card thumbnail carousel ──
const CardCarousel = ({ photos, alt }: { photos: string[]; alt: string }) => {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (photos.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Bike className="h-16 w-16 text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full h-full group/carousel">
        <img
          src={photos[current]}
          alt={alt}
          className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
          onClick={() => setLightboxOpen(true)}
        />

        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setCurrent(i => (i > 0 ? i - 1 : photos.length - 1)); }}
              className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover/carousel:opacity-100 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setCurrent(i => (i < photos.length - 1 ? i + 1 : 0)); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover/carousel:opacity-100 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Dots */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                  className={`w-1.5 h-1.5 rounded-full transition ${i === current ? "bg-white" : "bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Photo count badge */}
        {photos.length > 1 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-xs">
            <Camera className="h-3 w-3" /> {photos.length}
          </div>
        )}
      </div>

      <PhotoLightbox photos={photos} initialIndex={current} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </>
  );
};

// ── Main Page ──
const COEFS: Record<number, number> = { 12: 0.095, 24: 0.070, 36: 0.065, 48: 0.060, 60: 0.058 };
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const PublicCatalog = () => {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const navigate = useNavigate();

  const toggleCompare = (id: string) => {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["public-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_vehicles")
        .select("id, brand, model, year, km, color, price, selling_price, condition, photos, image_url, description, features, fipe_value")
        .eq("status", "available")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const brands = [...new Set(vehicles.map((v: any) => v.brand))].sort();

  const filtered = vehicles.filter((v: any) => {
    const matchSearch = `${v.brand} ${v.model} ${v.color || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchBrand = brandFilter === "all" || v.brand === brandFilter;
    return matchSearch && matchBrand;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">🏍️ Arsenal Motors</h1>
          <p className="text-primary-foreground/80 text-lg">Motos novas e seminovas com as melhores condições</p>
          <p className="text-sm mt-2 text-primary-foreground/60">{vehicles.length} motos disponíveis</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar moto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as marcas</SelectItem>
              {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando catálogo...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Bike className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma moto encontrada</h3>
            <p className="text-muted-foreground">Tente buscar com outros termos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((v: any) => {
              const allPhotos = [...(v.photos || []), ...(v.image_url && !(v.photos || []).includes(v.image_url) ? [v.image_url] : [])];
              const displayPrice = Number(v.selling_price || v.price || 0);
              const coef48 = 0.060;
              const parcela48 = displayPrice * coef48;

              return (
                <Card key={v.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="h-56 bg-muted relative overflow-hidden">
                    <CardCarousel photos={allPhotos} alt={`${v.brand} ${v.model}`} />
                    <Badge className="absolute top-3 left-3 z-10" variant={v.condition === "new" ? "default" : "secondary"}>
                      {v.condition === "new" ? "0km" : "Seminova"}
                    </Badge>
                  </div>

                  <CardContent className="p-5 space-y-3">
                    <div>
                      <h3 className="font-bold text-xl">{v.brand} {v.model}</h3>
                      <p className="text-sm text-muted-foreground">
                        {v.year && `${v.year}`}{v.km ? ` · ${v.km.toLocaleString()} km` : ""}{v.color ? ` · ${v.color}` : ""}
                      </p>
                    </div>

                    <div>
                      <p className="text-2xl font-bold text-primary">
                        R$ {displayPrice.toLocaleString("pt-BR")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ou 48x de <strong>R$ {parcela48.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                      </p>
                      {v.fipe_value && (
                        <p className="text-xs text-muted-foreground mt-1">
                          FIPE: R$ {Number(v.fipe_value).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>

                    {v.features?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {v.features.slice(0, 3).map((f: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                        ))}
                      </div>
                    )}

                    <Button className="w-full gap-2" onClick={() => navigate(`/chat?moto=${encodeURIComponent(`${v.brand} ${v.model} ${v.year || ""}`)}`)}>
                      <MessageCircle className="h-4 w-4" /> Tenho interesse!
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="bg-muted py-8 px-4 mt-8 text-center">
        <h2 className="text-xl font-bold mb-2">Não encontrou o que procura?</h2>
        <p className="text-muted-foreground mb-4">Fale com nosso consultor e encontramos a moto ideal pra você!</p>
        <Button size="lg" onClick={() => navigate("/chat")} className="gap-2">
          <MessageCircle className="h-5 w-5" /> Falar com Consultor
        </Button>
      </div>
    </div>
  );
};

export default PublicCatalog;
