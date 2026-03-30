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

// Gather full lead context
async function getLeadContext(clientId: string) {
  const [clientRes, interactionsRes, vehiclesRes, memoryRes, timelineRes, simulationsRes, tagsRes, conversationsRes] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).single(),
    supabase.from("interactions").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(30),
    supabase.from("vehicles").select("*").eq("client_id", clientId),
    supabase.from("lead_memory").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("lead_timeline_events").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(50),
    supabase.from("financing_simulations").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
    supabase.from("client_tag_assignments").select("*, client_tags(*)").eq("client_id", clientId),
    supabase.from("chat_conversations").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(3),
  ]);

  return {
    client: clientRes.data,
    interactions: interactionsRes.data || [],
    vehicles: vehiclesRes.data || [],
    memory: memoryRes.data,
    timeline: timelineRes.data || [],
    simulations: simulationsRes.data || [],
    tags: (tagsRes.data || []).map((t: any) => t.client_tags?.name).filter(Boolean),
    recentConversations: conversationsRes.data || [],
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

  return `Você é o AI Copilot da Arsenal Motors CRM. Você é o assistente de vendas EXCLUSIVO para este lead específico. Você NÃO é um chatbot genérico.

Seu papel: Ajudar o vendedor/admin a entender o cliente, decidir a melhor ação e gerar mensagens prontas para WhatsApp.

## DADOS DO LEAD (CONTEXTO)
- ID: ${c.id}
- Nome: ${c.name}
- Telefone: ${c.phone || "não informado"}
- Email: ${c.email || "não informado"}
- Cidade: ${c.city || "não informada"}
- Interesse: ${c.interest || "não informado"}
- Orçamento: ${c.budget_range || "não informado"}
- Tipo de pagamento: ${c.payment_type || "não informado"}
- Salário: ${c.salary ? `R$ ${c.salary}` : "não informado"}
- Renda bruta: ${c.gross_income ? `R$ ${c.gross_income}` : "não informada"}
- Empresa: ${c.employer || "não informada"}
- CNPJ empresa: ${c.employer_cnpj || "não informado"}
- Profissão: ${c.profession || "não informada"}
- Tem troca: ${c.has_trade_in ? "Sim" : "Não"}
- Tem entrada: ${c.has_down_payment ? "Sim" : "Não"} ${c.down_payment_amount ? `(R$ ${c.down_payment_amount})` : ""}
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
${memoryBlock}${timelineBlock}${interactionsBlock}${vehiclesBlock}${simsBlock}${conversationSummaries}

## SUAS CAPACIDADES

Você pode:
1. **Análise completa** - Analisar o perfil completo do lead e dar um diagnóstico
2. **Sugerir abordagem** - Dizer como abordar baseado no contexto
3. **Gerar mensagens** - Criar mensagens prontas para WhatsApp personalizadas
4. **Identificar objeções** - Detectar e sugerir como quebrar objeções
5. **Recomendar próxima ação** - Dizer exatamente o que fazer agora
6. **Montar propostas** - Criar propostas de financiamento personalizadas
7. **Classificar lead** - Dizer se está quente/morno/frio e porquê
8. **Sugerir veículos** - Recomendar opções baseado no perfil
9. **Estratégia de fechamento** - Criar plano de ação para fechar a venda
10. **Mensagem de reativação** - Para leads inativos

## FORMATO DE RESPOSTA

Sempre responda de forma prática e acionável. Use este formato quando apropriado:

**📊 Diagnóstico:** [análise breve do lead]
**🎯 Próxima ação:** [o que fazer AGORA]
**💬 Mensagem pronta:** [mensagem para copiar e enviar no WhatsApp]
**⚠️ Objeções:** [se houver]
**💡 Dica:** [estratégia adicional]

Quando gerar mensagens para WhatsApp, escreva como um vendedor real: informal, amigável, com emojis moderados, sem parecer robótico.

IMPORTANTE: Suas respostas são para o ADMIN/VENDEDOR, não para o cliente. O vendedor vai copiar a mensagem sugerida e enviar.`;
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
    const { client_id, messages, command, whatsapp_paste } = await req.json();

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
      allMessages.push(...messages);
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
        // Send content as SSE chunks
        const words = fullContent.split(" ");
        let i = 0;
        const sendChunk = () => {
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
          }
        };
        sendChunk();
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
