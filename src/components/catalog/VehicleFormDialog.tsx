import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import VehiclePhotoUpload from "./VehiclePhotoUpload";
import VehicleCostManager from "./VehicleCostManager";
import FipeLookup from "./FipeLookup";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: any;
  onSuccess: () => void;
}

const VehicleFormDialog = ({ open, onOpenChange, vehicle, onSuccess }: Props) => {
  const [form, setForm] = useState<any>({
    brand: "", model: "", year: "", color: "", km: "", condition: "used",
    status: "available", price: "", purchase_price: "", selling_price: "",
    fipe_value: "", plate: "", chassis: "", renavam: "", fuel: "Flex",
    seller_name: "", seller_phone: "", purchase_date: new Date().toISOString().split("T")[0],
    documents_cost: "", description: "", features: [],
    photos: [],
  });
  const isEdit = !!vehicle?.id;

  useEffect(() => {
    if (vehicle) {
      setForm({
        brand: vehicle.brand || "",
        model: vehicle.model || "",
        year: vehicle.year || "",
        color: vehicle.color || "",
        km: vehicle.km || "",
        condition: vehicle.condition || "used",
        status: vehicle.status || "available",
        price: vehicle.price || "",
        purchase_price: vehicle.purchase_price || "",
        selling_price: vehicle.selling_price || vehicle.price || "",
        fipe_value: vehicle.fipe_value || "",
        plate: vehicle.plate || "",
        chassis: vehicle.chassis || "",
        renavam: vehicle.renavam || "",
        fuel: vehicle.fuel || "Flex",
        seller_name: vehicle.seller_name || "",
        seller_phone: vehicle.seller_phone || "",
        purchase_date: vehicle.purchase_date || new Date().toISOString().split("T")[0],
        documents_cost: vehicle.documents_cost || "",
        description: vehicle.description || "",
        features: vehicle.features || [],
        photos: vehicle.photos || [],
      });
    } else {
      setForm({
        brand: "", model: "", year: "", color: "", km: "", condition: "used",
        status: "available", price: "", purchase_price: "", selling_price: "",
        fipe_value: "", plate: "", chassis: "", renavam: "", fuel: "Flex",
        seller_name: "", seller_phone: "", purchase_date: new Date().toISOString().split("T")[0],
        documents_cost: "", description: "", features: [],
        photos: [],
      });
    }
  }, [vehicle, open]);

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        brand: form.brand,
        model: form.model,
        year: form.year ? Number(form.year) : null,
        color: form.color || null,
        km: form.km ? Number(form.km) : null,
        condition: form.condition,
        status: form.status,
        price: Number(form.selling_price || form.price || 0),
        purchase_price: form.purchase_price ? Number(form.purchase_price) : 0,
        selling_price: form.selling_price ? Number(form.selling_price) : null,
        fipe_value: form.fipe_value ? Number(form.fipe_value) : null,
        plate: form.plate || null,
        chassis: form.chassis || null,
        renavam: form.renavam || null,
        fuel: form.fuel || null,
        seller_name: form.seller_name || null,
        seller_phone: form.seller_phone || null,
        purchase_date: form.purchase_date || null,
        documents_cost: form.documents_cost ? Number(form.documents_cost) : 0,
        description: form.description || null,
        features: form.features?.length ? form.features : null,
        photos: form.photos || [],
      };

      if (isEdit) {
        const { error } = await supabase.from("stock_vehicles").update(payload).eq("id", vehicle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stock_vehicles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Veículo atualizado!" : "Veículo cadastrado!");
      onSuccess();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Veículo" : "Novo Veículo"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="basic">Dados</TabsTrigger>
            <TabsTrigger value="financial">Financeiro</TabsTrigger>
            <TabsTrigger value="photos">Fotos</TabsTrigger>
            {isEdit && <TabsTrigger value="costs">Custos</TabsTrigger>}
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Marca *</Label>
                <Input value={form.brand} onChange={e => update("brand", e.target.value)} placeholder="Honda" />
              </div>
              <div>
                <Label>Modelo *</Label>
                <Input value={form.model} onChange={e => update("model", e.target.value)} placeholder="CG 160 Titan" />
              </div>
              <div>
                <Label>Ano</Label>
                <Input type="number" value={form.year} onChange={e => update("year", e.target.value)} placeholder="2024" />
              </div>
              <div>
                <Label>Cor</Label>
                <Input value={form.color} onChange={e => update("color", e.target.value)} placeholder="Preta" />
              </div>
              <div>
                <Label>KM</Label>
                <Input type="number" value={form.km} onChange={e => update("km", e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Combustível</Label>
                <Select value={form.fuel} onValueChange={v => update("fuel", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Flex">Flex</SelectItem>
                    <SelectItem value="Gasolina">Gasolina</SelectItem>
                    <SelectItem value="Etanol">Etanol</SelectItem>
                    <SelectItem value="Elétrico">Elétrico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Placa</Label>
                <Input value={form.plate} onChange={e => update("plate", e.target.value.toUpperCase())} placeholder="ABC1D23" />
              </div>
              <div>
                <Label>Chassi</Label>
                <Input value={form.chassis} onChange={e => update("chassis", e.target.value)} />
              </div>
              <div>
                <Label>Renavam</Label>
                <Input value={form.renavam} onChange={e => update("renavam", e.target.value)} />
              </div>
              <div>
                <Label>Condição</Label>
                <Select value={form.condition} onValueChange={v => update("condition", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">0km</SelectItem>
                    <SelectItem value="used">Seminova</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => update("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="reserved">Reservado</SelectItem>
                    <SelectItem value="sold">Vendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => update("description", e.target.value)} placeholder="Detalhes sobre o veículo..." />
            </div>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Comprado de (nome)</Label>
                <Input value={form.seller_name} onChange={e => update("seller_name", e.target.value)} placeholder="Nome do vendedor" />
              </div>
              <div>
                <Label>Telefone do vendedor</Label>
                <Input value={form.seller_phone} onChange={e => update("seller_phone", e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label>Data da compra</Label>
                <Input type="date" value={form.purchase_date} onChange={e => update("purchase_date", e.target.value)} />
              </div>
              <div>
                <Label>Valor de Compra (R$)</Label>
                <Input type="number" value={form.purchase_price} onChange={e => update("purchase_price", e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Custo de Documentação (R$)</Label>
                <Input type="number" value={form.documents_cost} onChange={e => update("documents_cost", e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Preço de Venda (R$) *</Label>
                <Input type="number" value={form.selling_price} onChange={e => update("selling_price", e.target.value)} placeholder="0" />
              </div>
            </div>

            {/* FIPE Lookup */}
            <FipeLookup
              brand={form.brand}
              model={form.model}
              year={form.year}
              onFipeValue={(value) => update("fipe_value", value)}
            />

            {form.fipe_value && (
              <div className="p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Valor FIPE:</span>
                <span className="ml-2 font-bold text-lg">R$ {Number(form.fipe_value).toLocaleString("pt-BR")}</span>
              </div>
            )}

            {/* Margin Preview */}
            {(form.selling_price || form.purchase_price) && (
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">📊 Prévia de Margem</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>Compra: <strong>R$ {Number(form.purchase_price || 0).toLocaleString("pt-BR")}</strong></div>
                  <div>Custos: <strong>R$ {Number(form.documents_cost || 0).toLocaleString("pt-BR")}</strong></div>
                  <div>Venda: <strong>R$ {Number(form.selling_price || 0).toLocaleString("pt-BR")}</strong></div>
                </div>
                <div className={`mt-2 text-lg font-bold ${(Number(form.selling_price || 0) - Number(form.purchase_price || 0) - Number(form.documents_cost || 0)) >= 0 ? "text-green-600" : "text-red-500"}`}>
                  Margem: R$ {(Number(form.selling_price || 0) - Number(form.purchase_price || 0) - Number(form.documents_cost || 0)).toLocaleString("pt-BR")}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="photos" className="mt-4">
            <VehiclePhotoUpload
              photos={form.photos}
              onPhotosChange={(photos) => update("photos", photos)}
              vehicleId={vehicle?.id}
            />
          </TabsContent>

          {isEdit && (
            <TabsContent value="costs" className="mt-4">
              <VehicleCostManager vehicleId={vehicle.id} />
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!form.brand || !form.model || saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : isEdit ? "Atualizar" : "Cadastrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleFormDialog;
