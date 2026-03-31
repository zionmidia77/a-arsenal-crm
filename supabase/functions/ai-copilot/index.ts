import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Gather lead context — optimized: fewer rows, selected columns only
async function getLeadContext(clientId: string) {
  const [clientRes, interactionsRes, vehiclesRes, memoryRes, timelineRes, simulationsRes, tagsRes, stockRes] = await Promise.all([
    supabase.from("clients").select("id,name,phone,email,city,interest,budget_range,payment_type,salary,gross_income,employer,profession,has_trade_in,has_down_payment,down_payment_amount,has_clean_credit,lead_score,arsenal_score,temperature,pipeline_stage,financing_status,source,notes,created_at,last_contact_at").eq("id", clientId).single(),
    supabase.from("interactions").select("created_at,type,content").eq("client_id", clientId).order("created_at", { ascending: false }).limit(10),
    supabase.from("vehicles").select("brand,model,year,status,is_financed,installments_paid,installments_total").eq("client_id", clientId),
    supabase.from("lead_memory").select("summary,objections,interests,behavior_patterns,decisions,ai_tags,recommended_action,last_analyzed_at").eq("client_id", clientId).maybeSingle(),
    supabase.from("lead_timeline_events").select("created_at,event_type,content").eq("client_id", clientId).order("created_at", { ascending: false }).limit(15),
    supabase.from("financing_simulations").select("moto_value,down_payment,months,monthly_payment,status").eq("client_id", clientId).order("created_at", { ascending: false }).limit(3),
    supabase.from("client_tag_assignments").select("client_tags(name)").eq("client_id", clientId),
    supabase.from("stock_vehicles").select("brand,model,year,color,km,price,fipe_value,condition").eq("status", "available").order("created_at", { ascending: false }).limit(10),
  ]);

  return {
    client: clientRes.data,
    interactions: interactionsRes.data || [],
    vehicles: vehiclesRes.data || [],
    memory: memoryRes.data,
    timeline: timelineRes.data || [],
    simulations: simulationsRes.data || [],
    tags: (tagsRes.data || []).map((t: any) => t.client_tags?.name).filter(Boolean),
    stockVehicles: stockRes.data || [],
  };
}

function buildSystemPrompt(ctx: any) {
  const c = ctx.client;
  if (!c) return "Lead não encontrado.";

  const daysAgo = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
  const lastContact = c.last_contact_at
    ? Math.floor((Date.now() - new Date(c.last_contact_at).getTime()) / 86400000) + " dias atrás"
    : "nunca";

  const mem = ctx.memory;
  const memoryBlock = mem
    ? `
## MEMÓRIA PERSISTENTE DO LEAD
- Resumo: ${mem.summary || "Sem resumo ainda"}
- Objeções: ${(mem.objections || []).join(", ") || "Nenhuma identificada"}
- Interesses: ${(mem.interests || []).join(", ") || "Não identificados"}
- Padrões: ${(mem.behavior_patterns || []).join(", ") || "Nenhum"}
- Decisões anteriores: ${(mem.decisions || []).join(", ") || "Nenhuma"}
- Tags IA: ${(mem.ai_tags || []).join(", ") || "Nenhuma"}
- Ação recomendada anterior: ${mem.recommended_action || "Nenhuma"}
- Última análise: ${mem.last_analyzed_at || "Nunca"}
`
    : "\n## MEMÓRIA: Nenhuma memória persistente ainda.\n";

  const timelineBlock = ctx.timeline.length > 0
    ? "\n## TIMELINE RECENTE\n" + ctx.timeline.slice(0, 20).map((e: any) =>
        `- [${new Date(e.created_at).toLocaleString("pt-BR")}] ${e.event_type}: ${e.content.slice(0, 200)}`
      ).join("\n")
    : "";

  const interactionsBlock = ctx.interactions.length > 0
    ? "\n## INTERAÇÕES RECENTES\n" + ctx.interactions.slice(0, 15).map((i: any) =>
        `- [${new Date(i.created_at).toLocaleString("pt-BR")}] ${i.type}: ${i.content.slice(0, 200)}`
      ).join("\n")
    : "";

  const vehiclesBlock = ctx.vehicles.length > 0
    ? "\n## VEÍCULOS DO CLIENTE\n" + ctx.vehicles.map((v: any) =>
        `- ${v.brand} ${v.model} ${v.year || ""} | ${v.status} | ${v.is_financed ? `Financiado ${v.installments_paid}/${v.installments_total}` : "Quitado"}`
      ).join("\n")
    : "";

  const simsBlock = ctx.simulations.length > 0
    ? "\n## SIMULAÇÕES DE FINANCIAMENTO\n" + ctx.simulations.map((s: any) =>
        `- R$ ${s.moto_value} | Entrada: R$ ${s.down_payment} | ${s.months}x R$ ${s.monthly_payment} | Status: ${s.status}`
      ).join("\n")
    : "";

  const conversationSummaries = ctx.recentConversations.length > 0
    ? "\n## CONVERSAS IA ANTERIORES\n" + ctx.recentConversations.map((conv: any) => {
        const msgs = Array.isArray(conv.messages) ? conv.messages : [];
        const userMsgs = msgs.filter((m: any) => m.role === "user").map((m: any) => m.content).slice(0, 3);
        return `- [${new Date(conv.created_at).toLocaleString("pt-BR")}] Status: ${conv.status} | Trechos: ${userMsgs.join(" | ").slice(0, 300)}`;
      }).join("\n")
    : "";

  const stockBlock = ctx.stockVehicles.length > 0
    ? "\n## ESTOQUE DISPONÍVEL (para propostas)\n" + ctx.stockVehicles.map((v: any) =>
        `- ${v.brand} ${v.model} ${v.year || ""} | ${v.color || ""} | ${v.km ? v.km + "km" : ""} | Preço: R$ ${Number(v.price).toLocaleString("pt-BR")} | FIPE: ${v.fipe_value ? "R$ " + Number(v.fipe_value).toLocaleString("pt-BR") : "N/A"} | ${v.condition}`
      ).join("\n")
    : "\n## ESTOQUE: Nenhum veículo disponível no momento.\n";

  return `Você é o AI Copilot da Arsenal Motors CRM — um VENDEDOR DIGITAL DE ELITE e ESPECIALISTA EM PROPOSTAS COMERCIAIS, exclusivo para este lead.

Você NÃO é um chatbot genérico. Você é um closer profissional com domínio de técnicas avançadas de vendas.

## SEU DNA DE VENDEDOR

Você domina e aplica automaticamente:

### 🔄 SPIN Selling
- **Situação**: Entender contexto atual do cliente (o que roda, quanto paga, há quanto tempo)
- **Problema**: Identificar dores (parcela alta, moto velha, manutenção cara, desvalorização)
- **Implicação**: Amplificar consequência de NÃO agir ("a cada mês sua moto perde R$ X de valor")
- **Necessidade de solução**: Fazer o cliente verbalizar que precisa resolver ("então faz sentido trocar agora, né?")

### 🧠 Gatilhos Mentais (usar nas mensagens)
- **Escassez**: "Essa é a última unidade nessa cor/preço"
- **Urgência**: "Condição válida só até sexta" / "Taxa especial acaba dia X"
- **Prova social**: "Essa semana já saíram 3 unidades desse modelo"
- **Ancoragem**: Sempre mostrar preço FIPE vs. preço Arsenal (economia visível)
- **Reciprocidade**: "Consegui negociar uma condição especial SÓ pra você"
- **Autoridade**: "Nosso financeiro analisou e aprovou essa condição"
- **Compromisso**: Fazer pequenas perguntas de SIM antes do fechamento

### 🎯 Método Sandler
- **Qualificar DOR antes de propor**: Não montar proposta sem entender a real necessidade
- **Orçamento real**: Perguntar quanto pode pagar por mês ANTES de sugerir veículo
- **Compromisso mútuo**: "Se eu conseguir uma parcela de R$ X, fechamos hoje?"
- **Reversão**: Deixar o cliente "vender" pra si mesmo

## SCRIPTS DE FECHAMENTO POR OBJEÇÃO

### "Tá caro" / "Parcela alta"
1. Ancorar no valor FIPE: "Olha, na FIPE esse modelo tá R$ [FIPE]. Aqui tá R$ [preço] — você economiza R$ [diferença]"
2. Diluir: "São R$ [parcela], dá R$ [parcela/30] por dia. Menos que um almoço"
3. Ajustar: Oferecer prazo maior ou entrada diferente
4. Comparar: "Quanto você gasta por mês com Uber/ônibus?"

### "Preciso pensar"
1. Isolar: "Claro! Só pra eu entender, o que te faz querer pensar mais? É o valor, o modelo ou outra coisa?"
2. Urgência: "Entendo perfeitamente. Só te aviso que essa condição é válida até [data]. Depois o preço volta ao normal"
3. Compromisso: "Que tal reservar sem compromisso por 24h? Assim ninguém pega antes"

### "Não tenho entrada"
1. Recalcular: Mostrar simulação 100% financiado
2. Troca: "Sua moto atual pode servir de entrada! Quanto acha que ela vale?"
3. Parcelamento de entrada: "Consigo parcelar a entrada em 3x no cartão"

### "Vou ver em outro lugar"
1. Comparar: "Ótimo! Posso te ajudar a comparar. O que estão oferecendo lá?"
2. Diferenciais: Documentação inclusa, revisão, garantia, atendimento
3. Exclusividade: "Essa condição é exclusiva Arsenal. Não vai encontrar igual"

### "Meu nome está sujo"
1. Empatia: "Acontece com muita gente. Vamos ver o que dá pra fazer"
2. Alternativas: Entrada maior para compensar, fiador, consórcio
3. Ação: "Me manda os documentos que verifico direto com o financeiro"

## ANÁLISE DE CONCORRÊNCIA

Sempre que montar proposta:
- Compare o preço Arsenal vs FIPE (mostrar economia em R$ e %)
- Se tiver dados do mercado OLX/Facebook, mencionar preços praticados
- Destaque diferenciais Arsenal: documentação, revisão, garantia, atendimento personalizado
- Crie tabela "Arsenal vs Mercado" quando relevante

## SEQUÊNCIA DE FOLLOW-UP PÓS-PROPOSTA

Quando o vendedor pedir, gere mensagens para a sequência completa:

**24h após proposta:**
"Fala [nome]! Tudo bem? Vi que separei aquela [veículo] pra você ontem. Conseguiu pensar? A condição especial ainda tá valendo! 😊"

**48h após proposta (escassez):**
"[nome], só passando pra avisar que tiveram mais 2 pessoas perguntando sobre a [veículo]. Como você demonstrou interesse primeiro, tô segurando pra você. Mas preciso de uma posição até amanhã, beleza? 🏍️"

**72h após proposta (última chance):**
"[nome], boa tarde! Infelizmente a condição especial que fiz pra você vence hoje. Depois disso o valor volta ao normal. Se quiser fechar, me chama que resolvo tudo rapidinho! 💪"

**7 dias (reengajamento):**
"[nome], tudo bem? Apareceram umas novidades no estoque que combinam com o que você procurava. Quer dar uma olhada? Posso mandar as opções! 🆕"

## DADOS DO LEAD (CONTEXTO)
- ID: ${c.id}
- Nome: ${c.name}
- Telefone: ${c.phone || "não informado"}
- Email: ${c.email || "não informado"}
- Cidade: ${c.city || "não informada"}
- Interesse: ${c.interest || "não informado"}
- Orçamento: ${c.budget_range || "não informado"}
- Tipo de pagamento: ${c.payment_type || "não informado"}
- Salário: ${c.salary ? "R$ " + c.salary : "não informado"}
- Renda bruta: ${c.gross_income ? "R$ " + c.gross_income : "não informada"}
- Empresa: ${c.employer || "não informada"}
- Profissão: ${c.profession || "não informada"}
- Tem troca: ${c.has_trade_in ? "Sim" : "Não"}
- Tem entrada: ${c.has_down_payment ? "Sim" : "Não"} ${c.down_payment_amount ? "(R$ " + c.down_payment_amount + ")" : ""}
- Crédito limpo: ${c.has_clean_credit ? "Sim" : "Não/desconhecido"}
- Score: ${c.lead_score} | Arsenal Score: ${c.arsenal_score}
- Temperatura: ${c.temperature}
- Pipeline: ${c.pipeline_stage}
- Status financiamento: ${c.financing_status || "não informado"}
- Documentos: ${JSON.stringify(c.financing_docs || {})}
- Origem: ${c.source || "desconhecida"}
- Criado há: ${daysAgo} dias
- Último contato: ${lastContact}
- Tags: ${ctx.tags.join(", ") || "nenhuma"}
- Notas: ${c.notes || "nenhuma"}
${memoryBlock}${timelineBlock}${interactionsBlock}${vehiclesBlock}${simsBlock}${conversationSummaries}${stockBlock}

## TABELA DE COEFICIENTES DE FINANCIAMENTO
Coeficientes FIXOS (multiplicar valor financiado pelo coeficiente):
- 12x: 0.095 | 24x: 0.070 | 36x: 0.065 | 48x: 0.060 | 60x: 0.058
Exemplo: R$ 20.000 em 48x = R$ 20.000 × 0.060 = R$ 1.200/mês
Regra: Parcela ideal ≤ 30% da renda do cliente

## SUAS CAPACIDADES

1. **Proposta completa** — Formatada com veículo, valor, entrada, parcelas, gatilhos
2. **Proposta comparativa** — 2-3 opções lado a lado
3. **Simulação de parcelas** — Múltiplos cenários de entrada/prazo
4. **Proposta com troca** — Considerando veículo do cliente
5. **Quebrar objeção** — Script específico para a objeção do lead
6. **Follow-up sequencial** — Mensagens 24h, 48h, 72h, 7 dias pós-proposta
7. **Análise de concorrência** — Arsenal vs FIPE vs mercado
8. **Estratégia de fechamento** — Plano completo com técnica ideal
9. **Análise SPIN** — Diagnóstico usando perguntas SPIN
10. **Gerar mensagens** — WhatsApp com gatilhos mentais
11. **Classificar lead** — Temperatura com justificativa

## FORMATO DE PROPOSTA

Quando montar propostas, use ESTE formato:

---
### 🏍️ PROPOSTA ARSENAL MOTORS

**Para:** [nome] | **Data:** [data atual]

---

**Veículo:** [marca modelo ano]
**Cor:** [cor] | **KM:** [km] | **Condição:** [novo/seminovo]

💰 **Valores:**
| | Valor |
|---|---|
| Preço Arsenal | R$ XX.XXX |
| Valor FIPE | R$ XX.XXX |
| **Sua economia** | **R$ X.XXX (X%)** |

📋 **Opções de Pagamento:**

| | À vista | 36x | 48x | 60x |
|---|---|---|---|---|
| Entrada | - | R$ X.XXX | R$ X.XXX | R$ X.XXX |
| Parcela | - | R$ XXX | R$ XXX | R$ XXX |
| Total | R$ XX.XXX | R$ XX.XXX | R$ XX.XXX | R$ XX.XXX |

${c.has_trade_in ? `
🔄 **Com troca:** Avaliação estimada: R$ X.XXX → Valor restante: R$ X.XXX
` : ""}

✅ **Incluso:** Documentação transferida, revisão completa, garantia
⏰ **Validade:** 48 horas

🎯 **Por que AGORA?** [gatilho de urgência/escassez personalizado]

---

**💬 Mensagem pronta para WhatsApp:**
[mensagem com gatilhos mentais, personalizada para o perfil]

---

## REGRAS DE OURO

1. SEMPRE use veículos do estoque disponível
2. SEMPRE mostre economia vs FIPE (ancoragem)
3. SEMPRE inclua gatilho de urgência na proposta
4. SEMPRE calcule se a parcela cabe no bolso (≤ 30% da renda)
5. SEMPRE gere mensagem WhatsApp pronta para copiar
6. Suas respostas são para o VENDEDOR, não para o cliente
7. Quando não souber a renda, PERGUNTE antes de montar proposta
8. Use linguagem de vendedor real: informal, confiante, amigável`;
}

// Tools for the copilot to update memory
const copilotTools = [
  {
    type: "function",
    function: {
      name: "update_lead_memory",
      description: "Update the persistent memory for this lead based on the analysis. Call after every meaningful analysis.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          summary: { type: "string", description: "Updated summary of the lead's situation" },
          objections: { type: "array", items: { type: "string" }, description: "List of identified objections" },
          interests: { type: "array", items: { type: "string" }, description: "List of detected interests" },
          behavior_patterns: { type: "array", items: { type: "string" }, description: "Behavioral patterns noticed" },
          decisions: { type: "array", items: { type: "string" }, description: "Previous decisions made" },
          ai_tags: { type: "array", items: { type: "string" }, description: "Auto-classification tags like: parcela alta, sem entrada, financiamento, lead quente, lead frio, sumido, pronto para fechar, sensível a preço, alto potencial" },
          recommended_action: { type: "string", description: "What the seller should do next" },
          recommended_message: { type: "string", description: "Ready-to-send WhatsApp message" },
          lead_temperature_ai: { type: "string", enum: ["hot", "warm", "cold", "frozen"], description: "AI assessment of lead temperature" },
        },
        required: ["client_id"],
        additionalProperties: false,
      },
    },
  },
];

async function handleToolCall(name: string, args: any) {
  if (name === "update_lead_memory") {
    const { client_id, ...updates } = args;
    // Upsert memory
    const { data: existing } = await supabase
      .from("lead_memory")
      .select("id")
      .eq("client_id", client_id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("lead_memory")
        .update({ ...updates, last_analyzed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("client_id", client_id);
    } else {
      await supabase
        .from("lead_memory")
        .insert({ client_id, ...updates, last_analyzed_at: new Date().toISOString() });
    }

    // Log timeline event
    await supabase.from("lead_timeline_events").insert({
      client_id,
      event_type: "ai_analysis",
      content: `IA atualizou memória: ${updates.summary?.slice(0, 200) || "Análise realizada"}`,
      source: "ai",
      metadata: { ai_tags: updates.ai_tags, recommended_action: updates.recommended_action },
    });

    return { success: true, message: "Memory updated" };
  }
  return { error: "Unknown tool" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id, messages, command, whatsapp_paste, images } = await req.json();

    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load full context
    const ctx = await getLeadContext(client_id);
    if (!ctx.client) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(ctx);

    // Handle WhatsApp paste: analyze and update memory
    if (whatsapp_paste) {
      // Save to timeline
      await supabase.from("lead_timeline_events").insert({
        client_id,
        event_type: "whatsapp_paste",
        content: whatsapp_paste.slice(0, 5000),
        source: "manual",
      });

      // Also log as interaction
      await supabase.from("interactions").insert({
        client_id,
        type: "whatsapp",
        content: `Conversa WhatsApp colada (${whatsapp_paste.length} chars)`,
        created_by: "admin",
      });
    }

    // Build conversation messages
    const allMessages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (whatsapp_paste) {
      allMessages.push({
        role: "user",
        content: `Analise esta conversa de WhatsApp colada e atualize a memória do lead. Identifique: resumo, objeções, interesses, temperatura, próxima ação recomendada e gere uma mensagem de resposta pronta.\n\nCONVERSA:\n${whatsapp_paste}`,
      });
    } else if (messages && messages.length > 0) {
      // Check if we have images to attach to the last user message
      if (images && Array.isArray(images) && images.length > 0) {
        // Find last user message and make it multimodal
        const processedMessages = messages.map((msg: any, idx: number) => {
          if (idx === messages.length - 1 && msg.role === "user") {
            // Build multimodal content array
            const contentParts: any[] = [];
            
            // Add text first
            if (msg.content) {
              contentParts.push({ type: "text", text: msg.content + "\n\nAnalise as imagens acima. São prints de conversas do WhatsApp/Facebook deste lead. Extraia: resumo da conversa, objeções, interesses, temperatura do lead, e sugira a próxima ação. Atualize a memória do lead." });
            } else {
              contentParts.push({ type: "text", text: "Analise as imagens acima. São prints de conversas do WhatsApp/Facebook deste lead. Extraia: resumo da conversa, objeções, interesses, temperatura do lead, e sugira a próxima ação. Atualize a memória do lead." });
            }

            // Add images
            for (const img of images.slice(0, 10)) {
              contentParts.push({
                type: "image_url",
                image_url: {
                  url: `data:${img.media_type};base64,${img.data}`,
                },
              });
            }

            return { role: "user", content: contentParts };
          }
          return msg;
        });
        allMessages.push(...processedMessages);

        // Log image upload to timeline
        await supabase.from("lead_timeline_events").insert({
          client_id,
          event_type: "document_uploaded",
          content: `${images.length} imagem(ns) de conversa enviada(s) para análise IA`,
          source: "manual",
          metadata: { image_count: images.length },
        });
      } else {
        allMessages.push(...messages);
      }
    } else if (command) {
      allMessages.push({ role: "user", content: command });
    } else {
      // Default: generate initial analysis
      allMessages.push({
        role: "user",
        content: "Faça uma análise completa deste lead. Inclua: diagnóstico, temperatura, objeções detectadas, próxima ação recomendada e uma mensagem pronta para WhatsApp. Atualize a memória do lead.",
      });
    }

    // Call AI with tool calling
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: allMessages,
        tools: copilotTools,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response, intercepting tool calls
    const reader = aiResponse.body!.getReader();
    const decoder = new TextDecoder();

    // We need to collect the full response to handle tool calls, then stream content
    let fullContent = "";
    let toolCalls: any[] = [];
    let currentToolCall: any = null;
    let buffer = "";

    // Collect the entire response first to handle tool calls
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) fullContent += delta.content;
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) {
                currentToolCall = { id: tc.id, name: tc.function?.name || "", arguments: "" };
                toolCalls.push(currentToolCall);
              }
              if (tc.function?.arguments && currentToolCall) {
                currentToolCall.arguments += tc.function.arguments;
              }
              if (tc.function?.name && currentToolCall && !currentToolCall.name) {
                currentToolCall.name = tc.function.name;
              }
            }
          }
        } catch { /* partial JSON */ }
      }
    }

    // Process tool calls silently
    for (const tc of toolCalls) {
      try {
        const args = JSON.parse(tc.arguments);
        await handleToolCall(tc.name, { ...args, client_id });
      } catch (e) {
        console.error("Tool call error:", e);
      }
    }

    // If we had tool calls but no content, make a second call to get the response
    if (toolCalls.length > 0 && !fullContent.trim()) {
      const followUpMessages = [
        ...allMessages,
        { role: "assistant", content: null, tool_calls: toolCalls.map(tc => ({
          id: tc.id, type: "function", function: { name: tc.name, arguments: tc.arguments }
        }))},
        ...toolCalls.map(tc => ({
          role: "tool", tool_call_id: tc.id, content: JSON.stringify({ success: true })
        })),
      ];

      const followUp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: followUpMessages,
          stream: true,
        }),
      });

      if (followUp.ok) {
        return new Response(followUp.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    }

    // Return the content as SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let closed = false;
        const words = fullContent.split(" ");
        let i = 0;
        const sendChunk = () => {
          if (closed) return;
          try {
            if (i < words.length) {
              const chunk = (i === 0 ? "" : " ") + words[i];
              const sseData = JSON.stringify({
                choices: [{ delta: { content: chunk } }],
              });
              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
              i++;
              setTimeout(sendChunk, 10);
            } else {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              closed = true;
            }
          } catch {
            closed = true;
          }
        };
        sendChunk();
      },
      cancel() {
        // Client disconnected — no-op, sendChunk will stop via closed flag
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Copilot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
