import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_base64, client_id } = await req.json();

    if (!image_base64 || typeof image_base64 !== "string") {
      return new Response(JSON.stringify({ error: "Imagem é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "IA não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageUrl = image_base64.startsWith("data:")
      ? image_base64
      : `data:image/jpeg;base64,${image_base64}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em análise de documentos brasileiros para financiamento de veículos.
Analise a imagem e identifique o tipo de documento e extraia os dados relevantes.

Tipos de documentos suportados:
- CNH (Carteira Nacional de Habilitação)
- Comprovante de renda (holerite, contracheque, extrato bancário, declaração de IR)
- Comprovante de residência (conta de luz, água, telefone, etc)
- RG / CPF
- Outro documento

Responda APENAS com JSON válido:
{
  "document_type": "cnh" | "income_proof" | "address_proof" | "identity" | "other" | "not_document",
  "confidence": "high" | "medium" | "low",
  "extracted_data": {
    "full_name": "nome completo ou null",
    "cpf": "CPF ou null",
    "rg": "RG ou null",
    "birth_date": "data nascimento YYYY-MM-DD ou null",
    "cnh_number": "número CNH ou null",
    "cnh_category": "categoria (A, B, AB, etc) ou null",
    "cnh_expiry": "validade YYYY-MM-DD ou null",
    "address": "endereço completo ou null",
    "city": "cidade ou null",
    "employer": "empregador ou null",
    "position": "cargo ou null",
    "salary": null ou número (salário bruto em reais),
    "income_period": "mês/ano referência ou null"
  },
  "summary": "Resumo breve do documento em 1-2 frases",
  "financing_relevant": true/false,
  "issues": ["lista de problemas encontrados, ex: documento vencido, ilegível, etc"] 
}

Se a imagem NÃO for um documento, retorne document_type: "not_document" com summary explicando o que vê.`
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageUrl } },
              { type: "text", text: "Analise este documento e extraia todas as informações relevantes para financiamento." }
            ],
          },
        ],
        max_tokens: 1500,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições, tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro ao analisar documento com IA");
    }

    const aiData = await aiResponse.json();
    const content = aiData?.choices?.[0]?.message?.content;

    let result: any = {};
    if (typeof content === "string") {
      // Clean markdown code blocks if present
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      result = JSON.parse(cleaned);
    } else if (content && typeof content === "object") {
      result = content;
    }

    // If we have a client_id, update the client's data and financing_docs
    if (client_id && result.document_type !== "not_document") {
      const updates: Record<string, any> = {};
      const docUpdates: Record<string, boolean> = {};
      const ext = result.extracted_data || {};

      if (result.document_type === "cnh") {
        docUpdates.cnh = true;
        if (ext.full_name) updates.name = ext.full_name;
        if (ext.birth_date) updates.birthdate = ext.birth_date;
        if (ext.city) updates.birth_city = ext.city;
      }

      if (result.document_type === "income_proof") {
        docUpdates.pay_stub = true;
        if (ext.employer) updates.employer = ext.employer;
        if (ext.position) updates.position = ext.position;
        if (ext.salary) updates.salary = ext.salary;
      }

      if (result.document_type === "address_proof") {
        docUpdates.proof_of_residence = true;
        if (ext.city) updates.city = ext.city;
      }

      // Fetch current financing_docs to merge
      const { data: client } = await supabase
        .from("clients")
        .select("financing_docs")
        .eq("id", client_id)
        .single();

      const currentDocs = (client?.financing_docs as Record<string, boolean>) || {
        cnh: false, pay_stub: false, reference: false, proof_of_residence: false,
      };

      const mergedDocs = { ...currentDocs, ...docUpdates };

      // Check if all docs complete
      const allComplete = mergedDocs.cnh && mergedDocs.pay_stub && mergedDocs.proof_of_residence;

      updates.financing_docs = mergedDocs;
      if (allComplete) {
        updates.financing_status = "complete";
      } else {
        updates.financing_status = "incomplete";
      }
      updates.last_contact_at = new Date().toISOString();

      await supabase.from("clients").update(updates).eq("id", client_id);

      // Log interaction
      await supabase.from("interactions").insert({
        client_id,
        type: "system" as const,
        content: `📄 Documento analisado via chat: ${result.document_type} (${result.confidence}). ${result.summary || ""}`,
        created_by: "ai-consultant",
      });
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao analisar documento" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
