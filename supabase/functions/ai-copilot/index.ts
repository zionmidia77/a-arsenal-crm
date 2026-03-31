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

// Optimized: fewer rows, selected columns only
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

// Compressed prompt — ~60% fewer tokens, same capabilities
function buildSystemPrompt(ctx: any) {
  const c = ctx.client;
  if (!c) return "Lead não encontrado.";

  const daysAgo = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
  const lastContact = c.last_contact_at
    ? Math.floor((Date.now() - new Date(c.last_contact_at).getTime()) / 86400000) + "d"
    : "nunca";

  const sections: string[] = [];

  // Memory
  const mem = ctx.memory;
  if (mem) {
    const parts = [
      mem.summary && `Resumo: ${mem.summary}`,
      mem.objections?.length && `Objeções: ${mem.objections.join(", ")}`,
      mem.interests?.length && `Interesses: ${mem.interests.join(", ")}`,
      mem.ai_tags?.length && `Tags: ${mem.ai_tags.join(", ")}`,
      mem.recommended_action && `Ação: ${mem.recommended_action}`,
    ].filter(Boolean);
    if (parts.length) sections.push("MEMÓRIA:\n" + parts.join("\n"));
  }

  if (ctx.timeline.length > 0) {
    sections.push("TIMELINE:\n" + ctx.timeline.slice(0, 10).map((e: any) =>
      `${e.event_type}: ${e.content.slice(0, 120)}`).join("\n"));
  }

  if (ctx.interactions.length > 0) {
    sections.push("INTERAÇÕES:\n" + ctx.interactions.slice(0, 8).map((i: any) =>
      `${i.type}: ${i.content.slice(0, 120)}`).join("\n"));
  }

  if (ctx.vehicles.length > 0) {
    sections.push("VEÍCULOS:\n" + ctx.vehicles.map((v: any) =>
      `${v.brand} ${v.model} ${v.year||""} ${v.status} ${v.is_financed?`Fin ${v.installments_paid}/${v.installments_total}`:"Quit"}`).join("\n"));
  }

  if (ctx.simulations.length > 0) {
    sections.push("SIMULAÇÕES:\n" + ctx.simulations.map((s: any) =>
      `R$${s.moto_value} Ent:R$${s.down_payment} ${s.months}x R$${s.monthly_payment} ${s.status}`).join("\n"));
  }

  if (ctx.stockVehicles.length > 0) {
    sections.push("ESTOQUE:\n" + ctx.stockVehicles.map((v: any) =>
      `${v.brand} ${v.model} ${v.year||""} ${v.color||""} ${v.km?v.km+"km":""} R$${v.price} FIPE:${v.fipe_value?"R$"+v.fipe_value:"?"} ${v.condition}`).join("\n"));
  }

  const ctx_blocks = sections.length > 0 ? "\n\n" + sections.join("\n\n") : "";

  return `Copilot de vendas Arsenal Motors. Closer profissional, consultor do VENDEDOR.

TÉCNICAS: SPIN(Situação→Problema→Implicação→Necessidade) + Gatilhos(escassez,urgência,ancoragem FIPE,prova social,reciprocidade) + Sandler(dor→orçamento→compromisso).

OBJEÇÕES:
• Caro → Ancorar FIPE vs Arsenal, diluir/dia, ajustar prazo
• Pensar → Isolar, urgência c/ prazo, reservar 24h
• Sem entrada → 100% financiado, troca, parcelar 3x cartão
• Outro lugar → Comparar, diferenciais Arsenal
• Nome sujo → Empatia, entrada maior, fiador, consórcio

FOLLOW-UP: 24h(interesse)→48h(escassez)→72h(última chance)→7d(novidades)

PROPOSTA: Veículo + Tabela Arsenal vs FIPE(economia R$,%) + Pagamento(à vista/36/48/60x) + Troca + Urgência + WhatsApp pronta

COEF: 12x:0.095|24x:0.070|36x:0.065|48x:0.060|60x:0.058 (parcela≤30% renda)

REGRAS: Usar estoque. Mostrar economia FIPE. Gatilho urgência. Msg WhatsApp. Perguntar renda se faltar.

LEAD: ${c.name}|Tel:${c.phone||"?"}|${c.city||"?"}|Interesse:${c.interest||"?"}|Orçamento:${c.budget_range||"?"}|Pgto:${c.payment_type||"?"}
Renda:${c.salary?"R$"+c.salary:"?"}/${c.gross_income?"R$"+c.gross_income:"?"}|Empresa:${c.employer||"?"}|Prof:${c.profession||"?"}
Troca:${c.has_trade_in?"S":"N"}|Entrada:${c.has_down_payment?"S":"N"}${c.down_payment_amount?" R$"+c.down_payment_amount:""}|Crédito:${c.has_clean_credit?"ok":"?"}
Score:${c.lead_score}/${c.arsenal_score}|Temp:${c.temperature}|Stage:${c.pipeline_stage}|Financ:${c.financing_status||"?"}
Origem:${c.source||"?"}|${daysAgo}d|Contato:${lastContact}|Tags:${ctx.tags.join(",")||"-"}${c.notes?"\nNotas:"+c.notes.slice(0,150):""}${ctx_blocks}`;
}

// Tools for the copilot to update memory
const copilotTools = [
  {
    type: "function",
    function: {
      name: "update_lead_memory",
      description: "Update persistent lead memory after analysis.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          summary: { type: "string" },
          objections: { type: "array", items: { type: "string" } },
          interests: { type: "array", items: { type: "string" } },
          behavior_patterns: { type: "array", items: { type: "string" } },
          decisions: { type: "array", items: { type: "string" } },
          ai_tags: { type: "array", items: { type: "string" } },
          recommended_action: { type: "string" },
          recommended_message: { type: "string" },
          lead_temperature_ai: { type: "string", enum: ["hot", "warm", "cold", "frozen"] },
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

    await supabase.from("lead_timeline_events").insert({
      client_id,
      event_type: "ai_analysis",
      content: `IA atualizou memória: ${updates.summary?.slice(0, 200) || "Análise realizada"}`,
      source: "ai",
      metadata: { ai_tags: updates.ai_tags, recommended_action: updates.recommended_action },
    });

    return { success: true };
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

    const ctx = await getLeadContext(client_id);
    if (!ctx.client) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(ctx);

    // Handle WhatsApp paste
    if (whatsapp_paste) {
      await Promise.all([
        supabase.from("lead_timeline_events").insert({
          client_id, event_type: "whatsapp_paste",
          content: whatsapp_paste.slice(0, 5000), source: "manual",
        }),
        supabase.from("interactions").insert({
          client_id, type: "whatsapp",
          content: `WhatsApp colado (${whatsapp_paste.length} chars)`, created_by: "admin",
        }),
      ]);
    }

    const allMessages: any[] = [{ role: "system", content: systemPrompt }];

    if (whatsapp_paste) {
      allMessages.push({
        role: "user",
        content: `Analise esta conversa WhatsApp. Identifique: resumo, objeções, interesses, temperatura, ação e mensagem de resposta. Atualize memória.\n\nCONVERSA:\n${whatsapp_paste.slice(0, 4000)}`,
      });
    } else if (messages && messages.length > 0) {
      if (images && Array.isArray(images) && images.length > 0) {
        const processedMessages = messages.map((msg: any, idx: number) => {
          if (idx === messages.length - 1 && msg.role === "user") {
            const contentParts: any[] = [
              { type: "text", text: (msg.content || "") + "\n\nAnalise as imagens. Extraia: resumo, objeções, interesses, temperatura, próxima ação. Atualize memória." },
            ];
            for (const img of images.slice(0, 5)) {
              contentParts.push({ type: "image_url", image_url: { url: `data:${img.media_type};base64,${img.data}` } });
            }
            return { role: "user", content: contentParts };
          }
          return msg;
        });
        allMessages.push(...processedMessages);

        await supabase.from("lead_timeline_events").insert({
          client_id, event_type: "document_uploaded",
          content: `${images.length} imagem(ns) enviada(s) para análise IA`,
          source: "manual", metadata: { image_count: images.length },
        });
      } else {
        allMessages.push(...messages);
      }
    } else if (command) {
      allMessages.push({ role: "user", content: command });
    } else {
      allMessages.push({
        role: "user",
        content: "Análise rápida: diagnóstico, temperatura, objeções, próxima ação, msg WhatsApp. Atualize memória.",
      });
    }

    // Log AI usage
    supabase.from("ai_usage_logs").insert({ function_name: "ai-copilot" }).then(() => {});

    // Use flash-lite for cheaper calls
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
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

    // Collect response, handle tool calls
    const reader = aiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let toolCalls: any[] = [];
    let currentToolCall: any = null;
    let buffer = "";

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

    // Process tool calls
    for (const tc of toolCalls) {
      try {
        const args = JSON.parse(tc.arguments);
        await handleToolCall(tc.name, { ...args, client_id });
      } catch (e) {
        console.error("Tool call error:", e);
      }
    }

    // If tool calls only, make follow-up call
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
          model: "google/gemini-2.5-flash-lite",
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

    // Stream collected content as SSE
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
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`));
              i++;
              setTimeout(sendChunk, 10);
            } else {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              closed = true;
            }
          } catch { closed = true; }
        };
        sendChunk();
      },
      cancel() {},
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
