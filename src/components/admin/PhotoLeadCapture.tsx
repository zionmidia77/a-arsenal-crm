import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Upload, Loader2, CheckCircle2, UserPlus, RefreshCw, GitMerge, AlertTriangle, Users } from "lucide-react";
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
  birthdate: string | null;
  cpf: string | null;
  employer: string | null;
  position: string | null;
  salary: number | null;
};

type SimilarityCandidate = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  similarity_score: number;
  match_reasons: string[];
};

type Step = "upload" | "processing" | "review" | "duplicates" | "done";

const MAX_IMAGES = 5;

const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

const getInvokeErrorMessage = (error: any) => {
  const status = error?.context?.status;
  const body = error?.context?.body;

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      if (parsed?.error) return parsed.error;
    } catch { /* ignore */ }
  }

  if (status === 429) return "Muitas tentativas agora. Aguarde alguns segundos e tente novamente.";
  if (status === 402) return "Limite de IA atingido. Adicione créditos para continuar.";
  if (status === 401) return "Você precisa estar logado para usar a captura por foto.";

  return error?.message || "Erro ao processar imagem";
};

const scoreColor = (score: number) => {
  if (score >= 85) return "text-red-400";
  if (score >= 65) return "text-orange-400";
  return "text-yellow-400";
};

const scoreBg = (score: number) => {
  if (score >= 85) return "bg-red-500/10 border-red-500/30";
  if (score >= 65) return "bg-orange-500/10 border-orange-500/30";
  return "bg-yellow-500/10 border-yellow-500/30";
};

const scoreLabel = (score: number) => {
  if (score >= 90) return "Quase certeza";
  if (score >= 75) return "Muito provável";
  if (score >= 60) return "Provável";
  return "Possível";
};

const PhotoLeadCapture = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [previews, setPreviews] = useState<string[]>([]);
  const [editData, setEditData] = useState<ExtractedData | null>(null);
  const [candidates, setCandidates] = useState<SimilarityCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [result, setResult] = useState<{ action: string; client: any } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const reset = () => {
    setStep("upload");
    setPreviews([]);
    setEditData(null);
    setCandidates([]);
    setSelectedCandidate(null);
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
      const { data: { session } } = await supabase.auth.getSession();
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
      const similarCandidates: SimilarityCandidate[] = data.similar_candidates || [];
      setCandidates(similarCandidates);

      // If there are similar candidates, show the duplicates step
      if (similarCandidates.length > 0) {
        setStep("duplicates");
        toast.info(`${similarCandidates.length} lead(s) similar(es) encontrado(s)`);
      } else {
        setStep("review");
        toast.success(`${base64Images.length} imagem(ns) processada(s) — nenhum duplicado encontrado`);
      }
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

  const handleMerge = async (candidateId: string) => {
    if (!editData) return;
    setStep("processing");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autorizado");

      const response = await supabase.functions.invoke("extract-lead-from-image", {
        body: {
          image_base64_list: previews,
          action: "merge",
          merge_target_id: candidateId,
        },
      });

      if (response.error) throw new Error(getInvokeErrorMessage(response.error));
      const data = response.data;
      if (data?.error) throw new Error(data.error);

      setResult({ action: data.action || "merged", client: data.client });
      setStep("done");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients-all"] });
      toast.success("Lead mesclado com sucesso! 🔗");
    } catch (err: any) {
      toast.error(err.message || "Erro ao mesclar lead");
      setStep("duplicates");
    }
  };

  const handleCreateNew = () => {
    setStep("review");
  };

  const handleSave = async () => {
    if (!editData?.name?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setStep("processing");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autorizado");

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
          birthdate: editData.birthdate || null,
          employer: editData.employer || null,
          position: editData.position || null,
          salary: editData.salary || null,
          status: "lead" as const,
          temperature: "warm" as const,
          pipeline_stage: "new" as const,
        })
        .select()
        .single();

      if (error) throw error;

      setResult({ action: "created", client: newClient });
      setStep("done");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients-all"] });
      toast.success("Lead criado com sucesso! 🎉");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar lead");
      setStep("review");
    }
  };

  const update = (field: keyof ExtractedData, value: string) => {
    setEditData((prev) => (prev ? { ...prev, [field]: value || null } : null));
  };

  const confidenceColor = (c: string) => {
    if (c === "high") return "text-green-400";
    if (c === "medium") return "text-yellow-400";
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
          {/* --- UPLOAD STEP --- */}
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
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" /> Galeria (múltiplas)
                </Button>
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => cameraRef.current?.click()}>
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

          {/* --- PROCESSING STEP --- */}
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
                    <img key={idx} src={img} alt={`Preview ${idx + 1}`} className="w-full h-20 object-cover rounded-lg opacity-70" />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* --- DUPLICATES STEP (NEW) --- */}
          {step === "duplicates" && editData && (
            <motion.div
              key="duplicates"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 mt-2"
            >
              <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
                <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-orange-300">Possíveis duplicados encontrados</p>
                  <p className="text-xs text-muted-foreground">
                    Dados extraídos: <strong>{editData.name}</strong>
                    {editData.phone && ` • ${editData.phone}`}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {candidates.map((candidate) => (
                  <motion.div
                    key={candidate.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedCandidate === candidate.id
                        ? "border-primary bg-primary/10 ring-1 ring-primary/50"
                        : scoreBg(candidate.similarity_score) + " hover:bg-accent/10"
                    }`}
                    onClick={() => setSelectedCandidate(
                      selectedCandidate === candidate.id ? null : candidate.id
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{candidate.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-lg font-bold ${scoreColor(candidate.similarity_score)}`}>
                          {candidate.similarity_score}%
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {scoreLabel(candidate.similarity_score)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {candidate.phone && <span>📞 {candidate.phone}</span>}
                      {candidate.email && <span>✉️ {candidate.email}</span>}
                      {candidate.city && <span>📍 {candidate.city}</span>}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {candidate.match_reasons.map((reason, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-background/50 text-muted-foreground border border-border/50"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Similarity score bar visualization */}
              {candidates.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Score de similaridade</p>
                  {candidates.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="text-xs w-20 truncate">{c.name.split(" ")[0]}</span>
                      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${c.similarity_score}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className={`h-full rounded-full ${
                            c.similarity_score >= 85
                              ? "bg-red-500"
                              : c.similarity_score >= 65
                                ? "bg-orange-500"
                                : "bg-yellow-500"
                          }`}
                        />
                      </div>
                      <span className="text-xs font-mono w-8 text-right">{c.similarity_score}%</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={handleCreateNew}
                >
                  <UserPlus className="w-4 h-4 mr-1" /> Criar novo
                </Button>
                <Button
                  className="flex-1 rounded-xl glow-red"
                  disabled={!selectedCandidate}
                  onClick={() => selectedCandidate && handleMerge(selectedCandidate)}
                >
                  <GitMerge className="w-4 h-4 mr-1" /> Mesclar selecionado
                </Button>
              </div>

              <p className="text-[10px] text-center text-muted-foreground">
                Selecione um lead existente para mesclar, ou crie um novo lead
              </p>
            </motion.div>
          )}

          {/* --- REVIEW STEP --- */}
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
                  <p className="text-xs text-muted-foreground">{previews.length} imagem(ns) analisada(s)</p>
                  <div className="grid grid-cols-4 gap-2">
                    {previews.slice(0, 8).map((img, idx) => (
                      <img key={idx} src={img} alt={`Imagem ${idx + 1}`} className="w-full h-16 object-cover rounded-lg" />
                    ))}
                  </div>
                </div>
              )}

              {candidates.length > 0 && (
                <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs text-yellow-400">
                    ⚠️ {candidates.length} lead(s) similar(es) foram ignorados.{" "}
                    <button
                      className="underline hover:text-yellow-300"
                      onClick={() => setStep("duplicates")}
                    >
                      Ver duplicados
                    </button>
                  </p>
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
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações (CNH, CPF, detalhes)</label>
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
                  <UserPlus className="w-4 h-4 mr-1" /> Criar lead novo
                </Button>
              </div>
            </motion.div>
          )}

          {/* --- DONE STEP --- */}
          {step === "done" && result && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center space-y-4"
            >
              <CheckCircle2 className="w-14 h-14 mx-auto text-green-400" />
              <div>
                <p className="text-lg font-bold">
                  {result.action === "created"
                    ? "Lead criado!"
                    : result.action === "merged"
                      ? "Lead mesclado!"
                      : result.action === "updated"
                        ? "Lead atualizado!"
                        : "Lead já existia"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.client?.name} — {result.client?.phone || "sem telefone"}
                </p>
                {result.action === "merged" && (
                  <p className="text-xs text-green-400 mt-2">
                    🔗 Dados mesclados com sucesso ao lead existente
                  </p>
                )}
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
