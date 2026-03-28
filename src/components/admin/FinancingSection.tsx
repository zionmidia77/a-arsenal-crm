import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  FileCheck, Upload, CheckCircle2, Circle, AlertTriangle, Send,
  MessageCircle, Crown, Shield, Briefcase, DollarSign, Loader2, Edit2, Save,
  Building2, Search, ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, History, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateClient } from "@/hooks/useSupabase";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type FinancingDocs = {
  cnh: boolean;
  proof_of_residence: boolean;
  pay_stub: boolean;
  reference: boolean;
};

interface FinancingSectionProps {
  client: any;
}

const DOC_LABELS: { key: keyof FinancingDocs; label: string; emoji: string }[] = [
  { key: "cnh", label: "CNH ou RG com CPF", emoji: "🪪" },
  { key: "proof_of_residence", label: "Comprovante de Residência", emoji: "🏠" },
  { key: "pay_stub", label: "Holerite / Info Trabalho", emoji: "💼" },
  { key: "reference", label: "Referência Pessoal", emoji: "👤" },
];

const PRIORITY_FACTORS = [
  { key: "has_clean_credit", label: "Nome limpo", emoji: "✅", points: 25 },
  { key: "has_down_payment", label: "Tem entrada", emoji: "💰", points: 20 },
] as const;

const priorityScore = (client: any): { score: number; label: string; color: string } => {
  let score = 0;
  if (client.has_clean_credit) score += 25;
  if (client.has_down_payment) score += 20;

  // Employment > 1 year
  const et = (client.employment_time || "").toLowerCase();
  if (et.includes("ano") || et.includes("year") || parseInt(et) >= 12) score += 20;

  // Payment type
  if (client.payment_type === "cash") score += 30;
  else if (client.payment_type === "financing") score += 5;

  // Docs complete
  const docs: FinancingDocs = client.financing_docs || { cnh: false, proof_of_residence: false, pay_stub: false, reference: false };
  const docsComplete = Object.values(docs).every(Boolean);
  if (docsComplete) score += 15;

  if (score >= 80) return { score, label: "⭐ Premium", color: "text-yellow-400" };
  if (score >= 50) return { score, label: "🔥 Alta Prioridade", color: "text-primary" };
  if (score >= 25) return { score, label: "📊 Médio", color: "text-muted-foreground" };
  return { score, label: "📋 Padrão", color: "text-muted-foreground" };
};

const FinancingSection = ({ client }: FinancingSectionProps) => {
  const updateClient = useUpdateClient();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<any>(null);
  const [extractedPayStub, setExtractedPayStub] = useState<any>(null);
  const [showVerification, setShowVerification] = useState(true);
  const [verificationHistory, setVerificationHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [editFields, setEditFields] = useState({
    phone: client.phone || "",
    employer: client.employer || "",
    employment_time: client.employment_time || "",
    position: client.position || "",
    salary: client.salary || "",
    birth_city: client.birth_city || "",
    reference_name: client.reference_name || "",
    reference_phone: client.reference_phone || "",
    down_payment_amount: client.down_payment_amount || "",
  });

  // Load verification history
  useEffect(() => {
    const loadHistory = async () => {
      const { data } = await supabase
        .from("employer_verifications")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });
      if (data) {
        setVerificationHistory(data);
        // Show latest verification if exists and no current one
        if (data.length > 0 && !verification) {
          const latest = data[0];
          setVerification({
            company_name: latest.company_name,
            trading_name: latest.trading_name,
            sector: latest.sector,
            size: latest.size,
            status: latest.status,
            location: latest.location,
            address: latest.address,
            verified: latest.verified,
            cnpj_validated: latest.cnpj_validated,
            reliability_score: latest.reliability_score,
            source: latest.source,
            risk_flags: latest.risk_flags || [],
            positive_flags: latest.positive_flags || [],
            legal_nature: latest.legal_nature,
            share_capital: latest.share_capital,
          });
          if (latest.extracted_data && Object.keys(latest.extracted_data).length > 0) {
            setExtractedPayStub(latest.extracted_data);
          }
        }
      }
    };
    loadHistory();
  }, [client.id]);

  const docs: FinancingDocs = client.financing_docs || { cnh: false, proof_of_residence: false, pay_stub: false, reference: false };
  const docsCompleted = Object.values(docs).filter(Boolean).length;
  const docsTotal = DOC_LABELS.length;
  const allDocsComplete = docsCompleted === docsTotal;
  const pct = Math.round((docsCompleted / docsTotal) * 100);
  const priority = priorityScore(client);

  const toggleDoc = async (key: keyof FinancingDocs) => {
    const newDocs = { ...docs, [key]: !docs[key] };
    const allComplete = Object.values(newDocs).every(Boolean);

    updateClient.mutate({
      id: client.id,
      financing_docs: newDocs,
      financing_status: allComplete ? "ready" : "incomplete",
    } as any);

    if (allComplete && !allDocsComplete) {
      toast.success("🎉 Documentação completa! Ficha pronta para envio.");
    }
  };

  const verifyEmployer = async (file: File) => {
    setVerifying(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("verify-employer", {
        body: { image_base64: base64 },
      });

      if (error) throw error;

      if (data?.extracted) {
        setExtractedPayStub(data.extracted);
        // Auto-fill fields from pay stub
        const ext = data.extracted;
        const updates: any = { id: client.id };
        if (ext.employer_name && !client.employer) updates.employer = ext.employer_name;
        if (ext.position && !client.position) updates.position = ext.position;
        if (ext.salary_net && !client.salary) updates.salary = parseFloat(ext.salary_net);
        if (ext.employee_name && !client.name) updates.name = ext.employee_name;

        if (Object.keys(updates).length > 1) {
          updateClient.mutate(updates);
          setEditFields(prev => ({
            ...prev,
            employer: ext.employer_name || prev.employer,
            position: ext.position || prev.position,
            salary: ext.salary_net || prev.salary,
          }));
          toast.success("Dados do holerite preenchidos automaticamente!");
        }
      }

      if (data?.verification) {
        setVerification(data.verification);
        setShowVerification(true);
        toast.success("Empresa verificada com IA!");
      }
    } catch (err: any) {
      console.error("Verify error:", err);
      toast.error("Erro ao verificar empresa: " + (err.message || "tente novamente"));
    } finally {
      setVerifying(false);
    }
  };

  const handleUploadDoc = async (docKey: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem");
      return;
    }
    setUploading(docKey);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${client.id}/${docKey}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("financing-docs").upload(path, file);
      if (error) throw error;

      // Mark doc as complete
      const newDocs = { ...docs, [docKey]: true };
      const allComplete = Object.values(newDocs).every(Boolean);
      updateClient.mutate({
        id: client.id,
        financing_docs: newDocs,
        financing_status: allComplete ? "ready" : "incomplete",
      } as any);

      toast.success("Documento enviado!");
      if (allComplete) toast.success("🎉 Documentação completa!");

      // If pay stub, trigger employer verification
      if (docKey === "pay_stub") {
        verifyEmployer(file);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar documento");
    } finally {
      setUploading(null);
    }
  };

  const saveFields = () => {
    const updates: any = { id: client.id };
    Object.entries(editFields).forEach(([k, v]) => {
      if (k === "salary" || k === "down_payment_amount") {
        updates[k] = v ? parseFloat(String(v)) : null;
      } else {
        updates[k] = v || null;
      }
    });

    // Check if reference is complete
    if (editFields.reference_name && editFields.reference_phone) {
      const newDocs = { ...docs, reference: true };
      updates.financing_docs = newDocs;
      if (Object.values(newDocs).every(Boolean)) updates.financing_status = "ready";
    }

    updateClient.mutate(updates);
    setEditing(false);
    toast.success("Dados atualizados!");
  };

  const togglePriority = (key: string, value: boolean) => {
    updateClient.mutate({ id: client.id, [key]: value } as any);
  };

  const togglePaymentType = (type: string) => {
    updateClient.mutate({ id: client.id, payment_type: type } as any);
  };

  const buildWhatsAppFicha = (): string => {
    const lines = [
      "📋 *FICHA DE FINANCIAMENTO*",
      "━━━━━━━━━━━━━━━━━━",
      "",
      `👤 *Nome:* ${client.name}`,
      `📞 *Telefone:* ${client.phone || "—"}`,
      `📧 *Email:* ${client.email || "—"}`,
      `📍 *Cidade:* ${client.city || "—"}`,
      `🏙️ *Cidade Natal:* ${client.birth_city || editFields.birth_city || "—"}`,
      "",
      "━━━ *TRABALHO* ━━━",
      `🏢 *Empresa:* ${client.employer || editFields.employer || "—"}`,
      `⏰ *Tempo:* ${client.employment_time || editFields.employment_time || "—"}`,
      `👔 *Cargo:* ${client.position || editFields.position || "—"}`,
      `💰 *Salário:* ${client.salary ? `R$ ${Number(client.salary).toLocaleString("pt-BR")}` : "—"}`,
      "",
      "━━━ *REFERÊNCIA* ━━━",
      `👤 *Nome:* ${client.reference_name || editFields.reference_name || "—"}`,
      `📞 *Telefone:* ${client.reference_phone || editFields.reference_phone || "—"}`,
      "",
      "━━━ *INTERESSE* ━━━",
      `🏍️ *Interesse:* ${client.interest || "—"}`,
      `💵 *Orçamento:* ${client.budget_range || "—"}`,
      `💳 *Tipo:* ${client.payment_type === "cash" ? "À vista" : "Financiamento"}`,
      client.has_down_payment ? `💰 *Entrada:* R$ ${client.down_payment_amount ? Number(client.down_payment_amount).toLocaleString("pt-BR") : "Sim"}` : "",
      client.has_clean_credit ? "✅ *Nome limpo*" : "",
      "",
      "━━━ *DOCUMENTOS* ━━━",
      ...DOC_LABELS.map(d => `${docs[d.key] ? "✅" : "❌"} ${d.label}`),
      "",
      `📊 *Prioridade:* ${priority.label} (${priority.score}pts)`,
      "",
      client.notes ? `📝 *Obs:* ${client.notes}` : "",
    ].filter(Boolean);

    return lines.join("\n");
  };

  const sendFichaWhatsApp = () => {
    const FINANCEIRA_NUMBER = "5500000000000"; // placeholder
    const msg = buildWhatsAppFicha();
    window.open(`https://wa.me/${FINANCEIRA_NUMBER}?text=${encodeURIComponent(msg)}`);
    toast.success("Ficha aberta no WhatsApp!");
  };

  const copyFicha = () => {
    navigator.clipboard.writeText(buildWhatsAppFicha());
    toast.success("Ficha copiada!");
  };

  return (
    <div className="space-y-4">
      {/* Priority Score Badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" /> Prioridade do Cliente
          </p>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold font-mono ${priority.color}`}>{priority.score}pts</span>
            <span className={`text-xs font-medium ${priority.color}`}>{priority.label}</span>
          </div>
        </div>

        {/* Priority factors */}
        <div className="space-y-2">
          {PRIORITY_FACTORS.map((f) => (
            <div key={f.key} className="flex items-center justify-between py-1">
              <span className="text-xs flex items-center gap-1.5">
                {f.emoji} {f.label} <span className="text-muted-foreground">(+{f.points}pts)</span>
              </span>
              <Switch
                checked={!!client[f.key]}
                onCheckedChange={(v) => togglePriority(f.key, v)}
              />
            </div>
          ))}

          <div className="flex items-center justify-between py-1">
            <span className="text-xs flex items-center gap-1.5">
              💳 Tipo de pagamento
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={client.payment_type === "cash" ? "default" : "outline"}
                className="rounded-full text-[10px] h-6 px-2"
                onClick={() => togglePaymentType("cash")}
              >
                À vista (+30)
              </Button>
              <Button
                size="sm"
                variant={client.payment_type === "financing" || !client.payment_type ? "default" : "outline"}
                className="rounded-full text-[10px] h-6 px-2"
                onClick={() => togglePaymentType("financing")}
              >
                Financiamento
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Document Checklist */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-primary" /> Documentos para Financiamento
          </p>
          <span className={`text-xs font-mono ${allDocsComplete ? "text-green-400" : "text-muted-foreground"}`}>
            {docsCompleted}/{docsTotal}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-secondary overflow-hidden mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8 }}
            className={`h-full rounded-full ${allDocsComplete ? "bg-green-500" : "bg-primary"}`}
          />
        </div>

        <div className="space-y-2">
          {DOC_LABELS.map((doc) => (
            <div key={doc.key} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
              <button onClick={() => toggleDoc(doc.key)} className="shrink-0">
                {docs[doc.key] ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              <span className="text-sm flex-1">
                {doc.emoji} {doc.label}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-[10px] h-7 gap-1"
                disabled={uploading === doc.key}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleUploadDoc(doc.key, file);
                  };
                  input.click();
                }}
              >
                {uploading === doc.key ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3" />
                )}
                Foto
              </Button>
            </div>
          ))}
        </div>

        {allDocsComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center"
          >
            <p className="text-xs text-green-400 font-medium">
              ✅ Documentação completa — pronto para enviar ficha!
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* Employer Verification Result */}
      {(verifying || verification) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <button
            onClick={() => setShowVerification(!showVerification)}
            className="w-full flex items-center justify-between"
          >
            <p className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Verificação da Empresa
              {verifying && <Loader2 className="w-3 h-3 animate-spin" />}
            </p>
            <div className="flex items-center gap-2">
              {verification?.verified && (
                <ShieldCheck className="w-4 h-4 text-green-400" />
              )}
              {verification && !verification.verified && (
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              )}
              {showVerification ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
          </button>

          {showVerification && verifying && (
            <div className="mt-3 flex items-center gap-2 justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Analisando holerite e verificando empresa...</p>
            </div>
          )}

          {showVerification && !verifying && extractedPayStub && (
            <div className="mt-3 space-y-3">
              {/* Extracted Data */}
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  📋 Dados extraídos do holerite
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {extractedPayStub.employer_name && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">Empresa</p>
                      <p className="text-xs font-medium">{extractedPayStub.employer_name}</p>
                    </div>
                  )}
                  {extractedPayStub.employer_cnpj && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">CNPJ</p>
                      <p className="text-xs font-medium font-mono">{extractedPayStub.employer_cnpj}</p>
                    </div>
                  )}
                  {extractedPayStub.position && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">Cargo</p>
                      <p className="text-xs font-medium">{extractedPayStub.position}</p>
                    </div>
                  )}
                  {extractedPayStub.salary_net && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">Salário líquido</p>
                      <p className="text-xs font-medium text-green-400">
                        R$ {Number(extractedPayStub.salary_net).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  )}
                  {extractedPayStub.salary_gross && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">Salário bruto</p>
                      <p className="text-xs font-medium">
                        R$ {Number(extractedPayStub.salary_gross).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  )}
                  {extractedPayStub.admission_date && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">Admissão</p>
                      <p className="text-xs font-medium">{extractedPayStub.admission_date}</p>
                    </div>
                  )}
                  {extractedPayStub.reference_month && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">Mês referência</p>
                      <p className="text-xs font-medium">{extractedPayStub.reference_month}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Result */}
              {verification && (
                <div className={`rounded-xl p-3 border ${
                  verification.verified
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-amber-500/5 border-amber-500/20"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {verification.verified ? (
                      <ShieldCheck className="w-4 h-4 text-green-400" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                    )}
                    <p className="text-xs font-medium">
                      {verification.verified ? "Empresa verificada" : "Verificação inconclusiva"}
                    </p>
                    {verification.reliability_score && (
                      <span className={`text-[10px] font-bold font-mono ml-auto ${
                        verification.reliability_score >= 7 ? "text-green-400"
                        : verification.reliability_score >= 4 ? "text-amber-400"
                        : "text-red-400"
                      }`}>
                        {verification.reliability_score}/10
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {verification.company_name && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Nome: </span>
                        <span className="font-medium">{verification.company_name}</span>
                      </p>
                    )}
                    {verification.sector && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Setor: </span>{verification.sector}
                      </p>
                    )}
                    {verification.size && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Porte: </span>{verification.size}
                      </p>
                    )}
                    {verification.location && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Local: </span>{verification.location}
                      </p>
                    )}
                    {verification.description && (
                      <p className="text-[10px] text-muted-foreground mt-1">{verification.description}</p>
                    )}
                  </div>

                  {/* Flags */}
                  {verification.positive_flags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {verification.positive_flags.map((flag: string, i: number) => (
                        <span key={i} className="text-[9px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-full">
                          ✅ {flag}
                        </span>
                      ))}
                    </div>
                  )}
                  {verification.risk_flags?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {verification.risk_flags.map((flag: string, i: number) => (
                        <span key={i} className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full">
                          ⚠️ {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" /> Dados de Trabalho e Referência
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full text-[10px] h-7 gap-1"
            onClick={() => editing ? saveFields() : setEditing(true)}
          >
            {editing ? <Save className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
            {editing ? "Salvar" : "Editar"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "phone", label: "📞 Telefone", span: 2 },
            { key: "employer", label: "🏢 Empresa" },
            { key: "employment_time", label: "⏰ Tempo de empresa" },
            { key: "position", label: "👔 Cargo" },
            { key: "salary", label: "💰 Salário", type: "number" },
            { key: "birth_city", label: "🏙️ Cidade natal" },
            { key: "down_payment_amount", label: "💵 Valor entrada", type: "number" },
            { key: "reference_name", label: "👤 Nome referência" },
            { key: "reference_phone", label: "📞 Tel. referência" },
          ].map((field) => (
            <div key={field.key} className={field.span === 2 ? "col-span-2" : ""}>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">{field.label}</label>
              {editing ? (
                <Input
                  type={field.type || "text"}
                  value={(editFields as any)[field.key] || ""}
                  onChange={(e) => setEditFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
                />
              ) : (
                <p className="text-xs font-medium">
                  {field.type === "number" && (client as any)[field.key]
                    ? `R$ ${Number((client as any)[field.key]).toLocaleString("pt-BR")}`
                    : (client as any)[field.key] || "—"}
                </p>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Send to WhatsApp */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4"
      >
        <p className="text-sm font-medium mb-3 flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" /> Enviar Ficha para Financeira
        </p>

        {!allDocsComplete && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            <p className="text-[10px] text-yellow-400">
              Documentação incompleta ({docsCompleted}/{docsTotal}). Você pode enviar mesmo assim.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            className="flex-1 rounded-xl gap-1.5 glow-red"
            onClick={sendFichaWhatsApp}
          >
            <MessageCircle className="w-4 h-4" /> Enviar via WhatsApp
          </Button>
          <Button
            variant="outline"
            className="rounded-xl gap-1.5"
            onClick={copyFicha}
          >
            📋 Copiar
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default FinancingSection;
