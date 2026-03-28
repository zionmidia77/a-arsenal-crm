import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Upload, Loader2, CheckCircle2, UserPlus, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

type ExtractedData = {
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  interest: string | null;
  budget_range: string | null;
  notes: string | null;
  source: string;
  confidence: string;
};

type Step = "upload" | "processing" | "review" | "done";

const PhotoLeadCapture = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [editData, setEditData] = useState<ExtractedData | null>(null);
  const [result, setResult] = useState<{ action: string; client: any } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const reset = () => {
    setStep("upload");
    setPreview(null);
    setExtracted(null);
    setEditData(null);
    setResult(null);
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande (max 10MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setPreview(base64);
      setStep("processing");

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error("Você precisa estar logado");
          setStep("upload");
          return;
        }

        const response = await supabase.functions.invoke("extract-lead-from-image", {
          body: { image_base64: base64, action: "extract_only" },
        });

        if (response.error) throw new Error(response.error.message);
        
        const data = response.data;
        if (data.error) throw new Error(data.error);

        setExtracted(data.extracted);
        setEditData(data.extracted);
        setStep("review");
      } catch (err: any) {
        toast.error(err.message || "Erro ao processar imagem");
        setStep("upload");
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSave = async () => {
    if (!editData?.name?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setStep("processing");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autorizado");

      // Insert directly using the reviewed/edited data instead of re-processing the image
      const { data: existingClients } = editData.phone 
        ? await supabase.from("clients").select("*").or(`phone.eq.${editData.phone},phone.eq.${editData.phone.replace(/\D/g, "")}`).limit(1)
        : { data: [] };

      let data: { action: string; client: any };

      if (existingClients && existingClients.length > 0) {
        const existing = existingClients[0];
        const updates: Record<string, any> = {};
        if (editData.city && !existing.city) updates.city = editData.city;
        if (editData.email && !existing.email) updates.email = editData.email;
        if (editData.interest && !existing.interest) updates.interest = editData.interest;
        if (editData.budget_range && !existing.budget_range) updates.budget_range = editData.budget_range;
        if (editData.notes) {
          updates.notes = (existing.notes ? existing.notes + '\n---\n' : '') + 
            `[Foto ${new Date().toLocaleDateString('pt-BR')}] ${editData.notes}`;
        }

        if (Object.keys(updates).length > 0) {
          const { data: updated, error } = await supabase.from("clients").update(updates).eq("id", existing.id).select().single();
          if (error) throw error;
          data = { action: "updated", client: updated };
        } else {
          data = { action: "already_exists", client: existing };
        }
      } else {
        const { data: newClient, error } = await supabase.from("clients").insert({
          name: editData.name!,
          phone: editData.phone || null,
          email: editData.email || null,
          city: editData.city || null,
          interest: editData.interest || null,
          budget_range: editData.budget_range || null,
          notes: editData.notes || null,
          source: editData.source || "facebook",
          status: "lead" as const,
          temperature: "warm" as const,
          pipeline_stage: "new" as const,
        }).select().single();
        if (error) throw error;
        data = { action: "created", client: newClient };
      }

      setResult(data);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients-all"] });

      if (data.action === "created") toast.success("Lead criado com sucesso! 🎉");
      else if (data.action === "updated") toast.success("Lead atualizado com novos dados! ✏️");
      else toast.info("Lead já existia sem alterações");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar lead");
      setStep("review");
    }
  };

  const update = (field: keyof ExtractedData, value: string) => {
    setEditData(prev => prev ? { ...prev, [field]: value || null } : null);
  };

  const confidenceColor = (c: string) => {
    if (c === "high") return "text-green-500";
    if (c === "medium") return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full gap-1.5 h-9 text-xs">
          <Camera className="w-3.5 h-3.5" /> Captura por foto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Capturar lead por foto
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* UPLOAD STEP */}
          {step === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 mt-2"
            >
              <p className="text-sm text-muted-foreground">
                Envie um print de conversa do Facebook, WhatsApp ou qualquer imagem com dados do cliente. A IA vai extrair nome, telefone, CNH e mais.
              </p>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border/60 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Arraste uma imagem aqui</p>
                <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
                />
              </div>
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-2" /> Tirar foto com câmera
              </Button>
            </motion.div>
          )}

          {/* PROCESSING STEP */}
          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 text-center space-y-4"
            >
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <div>
                <p className="font-medium">Analisando imagem com IA...</p>
                <p className="text-sm text-muted-foreground">Extraindo dados de contato</p>
              </div>
              {preview && (
                <img src={preview} alt="Preview" className="w-32 h-32 object-cover rounded-xl mx-auto opacity-50" />
              )}
            </motion.div>
          )}

          {/* REVIEW STEP */}
          {step === "review" && editData && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 mt-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className={`font-medium ${confidenceColor(editData.confidence || "low")}`}>
                  {editData.confidence === "high" ? "✅ Alta confiança" :
                    editData.confidence === "medium" ? "⚠️ Confiança média" :
                      "❓ Baixa confiança"}
                </span>
                <span className="text-muted-foreground">— revise antes de salvar</span>
              </div>

              {preview && (
                <img src={preview} alt="Preview" className="w-full max-h-40 object-cover rounded-xl" />
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
                  <Input value={editData.name || ""} onChange={e => update("name", e.target.value)} className="rounded-xl bg-secondary border-border/50 h-10" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone</label>
                  <Input value={editData.phone || ""} onChange={e => update("phone", e.target.value)} className="rounded-xl bg-secondary border-border/50 h-10" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                  <Input value={editData.email || ""} onChange={e => update("email", e.target.value)} className="rounded-xl bg-secondary border-border/50 h-10" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Cidade</label>
                  <Input value={editData.city || ""} onChange={e => update("city", e.target.value)} className="rounded-xl bg-secondary border-border/50 h-10" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações (CNH, CPF, detalhes)</label>
                  <Textarea value={editData.notes || ""} onChange={e => update("notes", e.target.value)} className="rounded-xl bg-secondary border-border/50 min-h-[80px]" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={reset}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Nova foto
                </Button>
                <Button className="flex-1 rounded-xl glow-red" onClick={handleSave}>
                  <UserPlus className="w-4 h-4 mr-1" /> Salvar lead
                </Button>
              </div>
            </motion.div>
          )}

          {/* DONE STEP */}
          {step === "done" && result && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center space-y-4"
            >
              <CheckCircle2 className="w-14 h-14 mx-auto text-green-500" />
              <div>
                <p className="text-lg font-bold">
                  {result.action === "created" ? "Lead criado!" :
                    result.action === "updated" ? "Lead atualizado!" :
                      "Lead já existia"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.client?.name} — {result.client?.phone || "sem telefone"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={reset}>
                  Enviar outra foto
                </Button>
                <Button className="flex-1 rounded-xl" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoLeadCapture;
