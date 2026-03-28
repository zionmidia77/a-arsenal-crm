import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_base64 } = await req.json();

    if (!image_base64 || typeof image_base64 !== "string") {
      return new Response(
        JSON.stringify({ error: "Imagem do holerite é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Serviço de IA não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageUrl = image_base64.startsWith("data:")
      ? image_base64
      : `data:image/jpeg;base64,${image_base64}`;

    // Step 1: Extract employer data from pay stub image
    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Você é um especialista em análise de holerites e documentos trabalhistas brasileiros.
Analise a imagem do holerite/contracheque e extraia TODOS os dados possíveis.
Responda APENAS com JSON válido:
{
  "employer_name": "nome completo da empresa",
  "employer_cnpj": "CNPJ se visível",
  "employee_name": "nome do funcionário",
  "employee_cpf": "CPF se visível",
  "position": "cargo/função",
  "salary_gross": "salário bruto (número)",
  "salary_net": "salário líquido (número)",
  "admission_date": "data de admissão se visível",
  "department": "setor/departamento se visível",
  "reference_month": "mês/ano de referência",
  "employer_address": "endereço da empresa se visível",
  "confidence": "high/medium/low",
  "notes": "observações relevantes sobre o documento"
}
Se algum dado não for visível, use null.`,
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageUrl } },
              { type: "text", text: "Extraia todos os dados deste holerite/contracheque." },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      }),
    });

    if (!extractResponse.ok) {
      const errText = await extractResponse.text();
      console.error("AI extraction error:", extractResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "Erro ao analisar holerite" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractData = await extractResponse.json();
    const extractContent = extractData?.choices?.[0]?.message?.content;
    let extracted: any = {};
    try {
      extracted = typeof extractContent === "string" ? JSON.parse(extractContent) : extractContent || {};
    } catch {
      extracted = {};
    }

    // Step 2: If we got an employer name, verify it with AI knowledge
    let verification: any = null;
    if (extracted.employer_name) {
      const verifyPrompt = `Pesquise e verifique a empresa "${extracted.employer_name}"${extracted.employer_cnpj ? ` (CNPJ: ${extracted.employer_cnpj})` : ""}${extracted.employer_address ? ` localizada em ${extracted.employer_address}` : ""}.

Responda APENAS com JSON:
{
  "company_name": "nome oficial da empresa",
  "trading_name": "nome fantasia se diferente",
  "sector": "setor de atuação",
  "size": "porte (MEI/ME/EPP/Média/Grande)",
  "status": "ativa/inativa/não encontrada",
  "founded_year": "ano de fundação se conhecido",
  "location": "cidade/estado principal",
  "description": "breve descrição da empresa (1-2 frases)",
  "reliability_score": "1 a 10 - quão confiável parece para fins de financiamento",
  "risk_flags": ["lista de alertas se houver"],
  "positive_flags": ["lista de pontos positivos"],
  "verified": true/false
}
Se não conhecer a empresa, retorne verified: false e preencha o que puder.`;

      const verifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              content: "Você é um analista de crédito brasileiro. Verifique empresas para fins de aprovação de financiamento. Use seu conhecimento para fornecer informações sobre a empresa. Seja honesto quando não tiver informações suficientes.",
            },
            { role: "user", content: verifyPrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1000,
        }),
      });

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        const verifyContent = verifyData?.choices?.[0]?.message?.content;
        try {
          verification = typeof verifyContent === "string" ? JSON.parse(verifyContent) : verifyContent || null;
        } catch {
          verification = null;
        }
      }
    }

    return new Response(
      JSON.stringify({ extracted, verification }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("verify-employer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
