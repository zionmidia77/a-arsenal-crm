import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Bike, MessageCircle, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PublicCatalog = () => {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const navigate = useNavigate();

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
              const photos = v.photos || [];
              const displayPrice = Number(v.selling_price || v.price || 0);
              const coef48 = 0.060;
              const parcela48 = displayPrice * coef48;

              return (
                <Card key={v.id} className="overflow-hidden hover:shadow-xl transition-shadow group">
                  <div className="h-56 bg-muted relative overflow-hidden">
                    {photos.length > 0 ? (
                      <img src={photos[0]} alt={`${v.brand} ${v.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : v.image_url ? (
                      <img src={v.image_url} alt={`${v.brand} ${v.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Bike className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                    <Badge className="absolute top-3 left-3" variant={v.condition === "new" ? "default" : "secondary"}>
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
