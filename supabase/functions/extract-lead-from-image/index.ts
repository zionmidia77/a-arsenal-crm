import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_IMAGES_PER_REQUEST = 5;

type ExtractedData = {
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  interest: string | null;
  budget_range: string | null;
  notes: string | null;
  source: string;
  confidence: "high" | "medium" | "low";
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const toImageDataUrl = (value: string) =>
  value.startsWith("data:") ? value : `data:image/jpeg;base64,${value}`;

const normalizeExtracted = (raw: any): ExtractedData => ({
  name: typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim() : null,
  phone: typeof raw?.phone === "string" && raw.phone.trim() ? raw.phone.trim() : null,
  email: typeof raw?.email === "string" && raw.email.trim() ? raw.email.trim() : null,
  city: typeof raw?.city === "string" && raw.city.trim() ? raw.city.trim() : null,
  interest: typeof raw?.interest === "string" && raw.interest.trim() ? raw.interest.trim() : null,
  budget_range:
    typeof raw?.budget_range === "string" && raw.budget_range.trim()
      ? raw.budget_range.trim()
      : null,
  notes: typeof raw?.notes === "string" && raw.notes.trim() ? raw.notes.trim() : null,
  source: typeof raw?.source === "string" && raw.source.trim() ? raw.source.trim() : "facebook",
  confidence:
    raw?.confidence === "high" || raw?.confidence === "medium" || raw?.confidence === "low"
      ? raw.confidence
      : "medium",
});

const mergeExtractedData = (items: ExtractedData[]): ExtractedData => {
  const merged: ExtractedData = {
    name: null,
    phone: null,
    email: null,
    city: null,
    interest: null,
    budget_range: null,
    notes: null,
    source: "facebook",
    confidence: "low",
  };

  for (const item of items) {
    if (!merged.name && item.name) merged.name = item.name;
    if (!merged.phone && item.phone) merged.phone = item.phone;
    if (!merged.email && item.email) merged.email = item.email;
    if (!merged.city && item.city) merged.city = item.city;
    if (!merged.interest && item.interest) merged.interest = item.interest;
    if (!merged.budget_range && item.budget_range) merged.budget_range = item.budget_range;

    if (item.notes) {
      merged.notes = merged.notes ? `${merged.notes}\n---\n${item.notes}` : item.notes;
    }

    if (item.confidence === "high") {
      merged.confidence = "high";
    } else if (item.confidence === "medium" && merged.confidence !== "high") {
      merged.confidence = "medium";
    }
  }

  return merged;
};

const extractWithAI = async (apiKey: string, images: string[]) => {
  const userContent = [
    ...images.map((image) => ({
      type: "image_url",
      image_url: { url: toImageDataUrl(image) },
    })),
    {
      type: "text",
      text: "Extraia todos os dados de contato e informações relevantes dessas imagens/conversas.",
    },
  ];

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `Você é um assistente que extrai dados de contato de screenshots de conversas.
Analise TODAS as imagens e consolide as informações.
Se houver conflito, mantenha o dado mais completo.
Responda APENAS com JSON válido no formato:
{
  "name": "nome completo ou null",
  "phone": "telefone com DDD ou null",
  "email": "email ou null",
  "city": "cidade ou null",
  "interest": "interesse identificado ou null",
  "budget_range": "faixa de orçamento ou null",
  "notes": "resumo consolidado, incluindo CNH, CPF e demais dados relevantes",
  "source": "facebook",
  "confidence": "high/medium/low"
}
Para interesse, use se possível: "Quero comprar uma moto", "Quero trocar minha moto", "Quero vender minha moto", "Preciso de dinheiro".
Para budget_range, use: "Até R$ 15 mil", "R$ 15 a 30 mil", "R$ 30 a 50 mil", "Acima de R$ 50 mil".`,
        },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1200,
    }),
  });

  if (!aiResponse.ok) {
    const raw = await aiResponse.text();
    const err: any = new Error("Erro ao processar imagem com IA");
    err.status = aiResponse.status;
    err.raw = raw;
    try {
      const parsed = JSON.parse(raw);
      err.message = parsed?.error || parsed?.message || err.message;
    } catch {
      // ignore parse errors
    }
    throw err;
  }

  const aiData = await aiResponse.json();
  const content = aiData?.choices?.[0]?.message?.content;

  let parsedContent: any = {};
  if (typeof content === "string") {
    parsedContent = JSON.parse(content || "{}");
  } else if (content && typeof content === "object") {
    parsedContent = content;
  }

  return normalizeExtracted(parsedContent);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Configuração de backend incompleta" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Token inválido" }, 401);
    }

    const body = await req.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : "extract_only";

    const rawImages = Array.isArray(body?.image_base64_list)
      ? body.image_base64_list
      : typeof body?.image_base64 === "string"
        ? [body.image_base64]
        : [];

    const imageList = rawImages
      .filter((img: unknown): img is string => typeof img === "string" && img.trim().length > 0)
      .slice(0, MAX_IMAGES_PER_REQUEST);

    if (rawImages.length > MAX_IMAGES_PER_REQUEST) {
      return jsonResponse({ error: `Máximo de ${MAX_IMAGES_PER_REQUEST} imagens por envio` }, 400);
    }

    if (!imageList.length) {
      return jsonResponse({ error: "Pelo menos uma imagem é obrigatória" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "Serviço de IA não configurado" }, 500);
    }

    const extracted = await extractWithAI(LOVABLE_API_KEY, imageList);

    if (action === "extract_only") {
      return jsonResponse({ extracted, images_processed: imageList.length });
    }

    if (action !== "create") {
      return jsonResponse({ error: "Ação inválida" }, 400);
    }

    if (!extracted.name) {
      return jsonResponse(
        {
          error: "Não foi possível identificar o nome nas imagens",
          extracted,
        },
        400,
      );
    }

    let existingClient: any = null;
    if (extracted.phone) {
      const cleanPhone = extracted.phone.replace(/\D/g, "");
      const { data } = await supabase
        .from("clients")
        .select("*")
        .or(`phone.eq.${extracted.phone},phone.eq.${cleanPhone}`)
        .limit(1);

      if (data && data.length > 0) {
        existingClient = data[0];
      }
    }

    if (existingClient) {
      const updates: Record<string, any> = {};
      if (extracted.city && !existingClient.city) updates.city = extracted.city;
      if (extracted.email && !existingClient.email) updates.email = extracted.email;
      if (extracted.interest && !existingClient.interest) updates.interest = extracted.interest;
      if (extracted.budget_range && !existingClient.budget_range) updates.budget_range = extracted.budget_range;
      if (extracted.notes) {
        updates.notes =
          (existingClient.notes ? `${existingClient.notes}\n---\n` : "") +
          `[Fotos ${new Date().toLocaleDateString("pt-BR")} - ${imageList.length} imagem(ns)] ${extracted.notes}`;
      }

      if (Object.keys(updates).length > 0) {
        const { data, error } = await supabase
          .from("clients")
          .update(updates)
          .eq("id", existingClient.id)
          .select()
          .single();

        if (error) throw error;

        await supabase.from("interactions").insert({
          client_id: existingClient.id,
          type: "system",
          content: `Lead atualizado via captura de foto (${imageList.length} imagem(ns)). Dados extraídos: ${extracted.notes || "sem notas adicionais"}`,
          created_by: "ai-photo",
        });

        return jsonResponse({
          action: "updated",
          client: data,
          extracted,
          images_processed: imageList.length,
        });
      }

      return jsonResponse({
        action: "already_exists",
        client: existingClient,
        extracted,
        images_processed: imageList.length,
      });
    }

    const { data: newClient, error: insertError } = await supabase
      .from("clients")
      .insert({
        name: extracted.name,
        phone: extracted.phone || null,
        email: extracted.email || null,
        city: extracted.city || null,
        interest: extracted.interest || null,
        budget_range: extracted.budget_range || null,
        notes: extracted.notes || null,
        source: extracted.source || "facebook",
        status: "lead",
        temperature: "warm",
        pipeline_stage: "new",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return jsonResponse({
      action: "created",
      client: newClient,
      extracted,
      images_processed: imageList.length,
    });
  } catch (error: any) {
    console.error("Error in extract-lead-from-image:", error);

    if (error?.status === 429) {
      return jsonResponse(
        { error: "Muitas requisições para IA agora. Aguarde alguns segundos e tente novamente." },
        429,
      );
    }

    if (error?.status === 402) {
      return jsonResponse(
        { error: "Limite de uso de IA atingido. Adicione créditos para continuar." },
        402,
      );
    }

    if (error instanceof SyntaxError) {
      return jsonResponse({ error: "Resposta inválida da IA. Tente novamente com imagens mais nítidas." }, 500);
    }

    return jsonResponse({ error: error?.message || "Erro interno ao processar imagens" }, 500);
  }
});
