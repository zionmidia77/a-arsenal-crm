import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Upload, Loader2, CheckCircle2, UserPlus, RefreshCw } from "lucide-react";
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

const MAX_IMAGES = 5;

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.readAsDataURL(file);
  });

const getInvokeErrorMessage = (error: any) => {
  const status = error?.context?.status;
  const body = error?.context?.body;

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      if (parsed?.error) return parsed.error;
    } catch {
      // ignore parse errors
    }
  }

  if (status === 429) return "Muitas tentativas agora. Aguarde alguns segundos e tente novamente.";
  if (status === 402) return "Limite de IA atingido. Adicione créditos para continuar.";
  if (status === 401) return "Você precisa estar logado para usar a captura por foto.";

  return error?.message || "Erro ao processar imagem";
};

const PhotoLeadCapture = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [previews, setPreviews] = useState<string[]>([]);
  const [editData, setEditData] = useState<ExtractedData | null>(null);
  const [result, setResult] = useState<{ action: string; client: any } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const reset = () => {
    setStep("upload");
    setPreviews([]);
    setEditData(null);
    setResult(null);
  };

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      toast.error("Envie pelo menos uma imagem válida");
      return;
    }

    if (imageFiles.length > MAX_IMAGES) {
      toast.error(`Você pode enviar no máximo ${MAX_IMAGES} imagens por vez`);
      return;
    }

    const oversized = imageFiles.find((file) => file.size > 10 * 1024 * 1024);
    if (oversized) {
      toast.error("Uma das imagens é muito grande (máx. 10MB por imagem)");
      return;
    }

    setStep("processing");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Você precisa estar logado");
        setStep("upload");
        return;
      }

      const base64Images = await Promise.all(imageFiles.map(fileToDataUrl));
      setPreviews(base64Images);

      const response = await supabase.functions.invoke("extract-lead-from-image", {
        body: { image_base64_list: base64Images, action: "extract_only" },
      });

      if (response.error) {
        throw new Error(getInvokeErrorMessage(response.error));
      }

      const data = response.data;
      if (data?.error) throw new Error(data.error);
      if (!data?.extracted) throw new Error("Não foi possível extrair os dados das imagens");

      setEditData(data.extracted);
      setStep("review");
      toast.success(`${base64Images.length} imagem(ns) processada(s)`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar imagens");
      setStep("upload");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) handleFiles(files);
    },
    [handleFiles],
  );

  const handleSave = async () => {
    if (!editData?.name?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setStep("processing");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autorizado");

      // Smart deduplication: search by phone, email, OR name
      let existingClient = null;
      const cleanedPhone = editData.phone?.replace(/\D/g, "") || "";
      const cleanedName = (editData.name || "").trim().toLowerCase();
      const cleanedEmail = (editData.email || "").trim().toLowerCase();

      // Build OR conditions for matching
      const orConditions: string[] = [];

      if (cleanedPhone.length >= 8) {
        orConditions.push(`phone.ilike.%${cleanedPhone.slice(-8)}%`);
      }
      if (cleanedEmail) {
        orConditions.push(`email.ilike.${cleanedEmail}`);
      }

      if (orConditions.length > 0) {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .or(orConditions.join(","))
          .limit(5);

        if (error) throw error;
        if (data && data.length > 0) existingClient = data[0];
      }

      // Fallback: fuzzy name match if no phone/email match found
      if (!existingClient && cleanedName.length >= 3) {
        const nameParts = cleanedName.split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : null;

        if (lastName && lastName.length >= 2) {
          const { data, error } = await supabase
            .from("clients")
            .select("*")
            .ilike("name", `%${firstName}%${lastName}%`)
            .limit(3);

          if (error) throw error;
          if (data && data.length === 1) {
            // Only auto-match if exactly one result (high confidence)
            existingClient = data[0];
          }
        }
      }

      let data: { action: string; client: any };

      if (existingClient) {
        const updates: Record<string, any> = {};
        if (editData.city && !existingClient.city) updates.city = editData.city;
        if (editData.email && !existingClient.email) updates.email = editData.email;
        if (editData.interest && !existingClient.interest) updates.interest = editData.interest;
        if (editData.budget_range && !existingClient.budget_range) updates.budget_range = editData.budget_range;

        if (editData.notes) {
          const notesPrefix = `[Fotos ${new Date().toLocaleDateString("pt-BR")} - ${previews.length} imagem(ns)] `;
          updates.notes =
            (existingClient.notes ? `${existingClient.notes}\n---\n` : "") +
            `${notesPrefix}${editData.notes}`;
        }

        if (Object.keys(updates).length > 0) {
          const { data: updated, error } = await supabase
            .from("clients")
            .update(updates)
            .eq("id", existingClient.id)
            .select()
            .single();

          if (error) throw error;
          data = { action: "updated", client: updated };
        } else {
          data = { action: "already_exists", client: existingClient };
        }
      } else {
        const { data: newClient, error } = await supabase
          .from("clients")
          .insert({
            name: editData.name,
            phone: editData.phone || null,
            email: editData.email || null,
            city: editData.city || null,
            interest: editData.interest || null,
            budget_range: editData.budget_range || null,
            notes: editData.notes || null,
            source: editData.source || "facebook",
            status: "lead",
            temperature: "warm",
            pipeline_stage: "new",
          })
          .select()
          .single();

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
    setEditData((prev) => (prev ? { ...prev, [field]: value || null } : null));
  };

  const confidenceColor = (c: string) => {
    if (c === "high") return "text-success";
    if (c === "medium") return "text-warning";
    return "text-destructive";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
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
          {step === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 mt-2"
            >
              <p className="text-sm text-muted-foreground">
                Envie até {MAX_IMAGES} imagens da conversa (Facebook, WhatsApp etc). A IA junta tudo e
                extrai os dados em uma única ficha.
              </p>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border/60 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Arraste imagens ou clique para selecionar da galeria</p>
                <p className="text-xs text-muted-foreground mt-1">PNG/JPG • até 10MB por imagem • máx. {MAX_IMAGES}</p>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length) handleFiles(files);
                    e.target.value = "";
                  }}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" /> Galeria (múltiplas)
                </Button>

                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => cameraRef.current?.click()}
                >
                  <Camera className="w-4 h-4 mr-2" /> Câmera
                </Button>

                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFiles([file]);
                    e.target.value = "";
                  }}
                />
              </div>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 text-center space-y-4"
            >
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <div>
                <p className="font-medium">Analisando imagens com IA...</p>
                <p className="text-sm text-muted-foreground">Consolidando dados de {previews.length || 1} imagem(ns)</p>
              </div>

              {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {previews.slice(0, 6).map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`Preview ${idx + 1}`}
                      className="w-full h-20 object-cover rounded-lg opacity-70"
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

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
                  {editData.confidence === "high"
                    ? "✅ Alta confiança"
                    : editData.confidence === "medium"
                      ? "⚠️ Confiança média"
                      : "❓ Baixa confiança"}
                </span>
                <span className="text-muted-foreground">— revise antes de salvar</span>
              </div>

              {previews.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {previews.length} imagem(ns) analisada(s)
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {previews.slice(0, 8).map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Imagem ${idx + 1}`}
                        className="w-full h-16 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
                  <Input
                    value={editData.name || ""}
                    onChange={(e) => update("name", e.target.value)}
                    className="rounded-xl bg-secondary border-border/50 h-10"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone</label>
                  <Input
                    value={editData.phone || ""}
                    onChange={(e) => update("phone", e.target.value)}
                    className="rounded-xl bg-secondary border-border/50 h-10"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                  <Input
                    value={editData.email || ""}
                    onChange={(e) => update("email", e.target.value)}
                    className="rounded-xl bg-secondary border-border/50 h-10"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Cidade</label>
                  <Input
                    value={editData.city || ""}
                    onChange={(e) => update("city", e.target.value)}
                    className="rounded-xl bg-secondary border-border/50 h-10"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Observações (CNH, CPF, detalhes)
                  </label>
                  <Textarea
                    value={editData.notes || ""}
                    onChange={(e) => update("notes", e.target.value)}
                    className="rounded-xl bg-secondary border-border/50 min-h-[90px]"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={reset}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Novas fotos
                </Button>
                <Button className="flex-1 rounded-xl glow-red" onClick={handleSave}>
                  <UserPlus className="w-4 h-4 mr-1" /> Salvar lead
                </Button>
              </div>
            </motion.div>
          )}

          {step === "done" && result && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center space-y-4"
            >
              <CheckCircle2 className="w-14 h-14 mx-auto text-success" />
              <div>
                <p className="text-lg font-bold">
                  {result.action === "created"
                    ? "Lead criado!"
                    : result.action === "updated"
                      ? "Lead atualizado!"
                      : "Lead já existia"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.client?.name} — {result.client?.phone || "sem telefone"}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={reset}>
                  Enviar mais fotos
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
