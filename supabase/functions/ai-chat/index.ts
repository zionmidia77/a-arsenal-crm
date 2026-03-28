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

// ── Tools for the AI agent ──
const tools = [
  {
    type: "function",
    function: {
      name: "create_lead",
      description:
        "Create a new lead in the CRM. Call this as soon as you have the person's name AND phone number. You can update later with more info.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full name" },
          phone: { type: "string", description: "Phone/WhatsApp number" },
          interest: {
            type: "string",
            description: "What they want: comprar, trocar, vender, refinanciar",
          },
          budget_range: {
            type: "string",
            description: "Budget range if mentioned",
          },
          has_trade_in: {
            type: "boolean",
            description: "Has a vehicle to trade in",
          },
          has_clean_credit: {
            type: "boolean",
            description: "Has clean credit for financing",
          },
          has_down_payment: {
            type: "boolean",
            description: "Has money for down payment",
          },
          down_payment_amount: {
            type: "number",
            description: "Down payment amount if mentioned",
          },
          city: { type: "string", description: "City if mentioned" },
          birthdate: {
            type: "string",
            description: "Birth date in YYYY-MM-DD format if mentioned",
          },
        },
        required: ["name", "phone"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead",
      description:
        "Update an existing lead with new information collected during conversation",
      parameters: {
        type: "object",
        properties: {
          client_id: {
            type: "string",
            description: "The UUID of the lead to update",
          },
          interest: { type: "string" },
          budget_range: { type: "string" },
          has_trade_in: { type: "boolean" },
          has_clean_credit: { type: "boolean" },
          has_down_payment: { type: "boolean" },
          down_payment_amount: { type: "number" },
          city: { type: "string" },
          birthdate: { type: "string" },
          employer: { type: "string" },
          salary: { type: "number" },
          payment_type: {
            type: "string",
            enum: ["financing", "cash", "consortium"],
          },
          notes: { type: "string", description: "Additional notes" },
        },
        required: ["client_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_vehicles",
      description:
        "Search available vehicles in the inventory. Use to recommend options matching the client's profile.",
      parameters: {
        type: "object",
        properties: {
          brand: {
            type: "string",
            description: "Brand filter (e.g. Honda, Yamaha)",
          },
          max_value: {
            type: "number",
            description: "Maximum estimated value",
          },
          min_value: {
            type: "number",
            description: "Minimum estimated value",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_interaction",
      description: "Log an important interaction/event in the client timeline",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          content: {
            type: "string",
            description: "What happened in the interaction",
          },
        },
        required: ["client_id", "content"],
        additionalProperties: false,
      },
    },
  },
];

// ── Execute tool calls ──
async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (name) {
      case "create_lead": {
        const { data, error } = await supabase
          .from("clients")
          .insert({
            name: args.name as string,
            phone: args.phone as string,
            interest: (args.interest as string) || null,
            budget_range: (args.budget_range as string) || null,
            has_trade_in: (args.has_trade_in as boolean) || false,
            has_clean_credit: (args.has_clean_credit as boolean) || null,
            has_down_payment: (args.has_down_payment as boolean) || false,
            down_payment_amount:
              (args.down_payment_amount as number) || null,
            city: (args.city as string) || null,
            birthdate: (args.birthdate as string) || null,
            source: "ai-chat",
            status: "lead",
            temperature: "hot",
            pipeline_stage: "new",
          })
          .select("id, name")
          .single();

        if (error) throw error;

        // Log the interaction
        await supabase.from("interactions").insert({
          client_id: data.id,
          type: "system",
          content: `Lead criado via chat IA. Interesse: ${args.interest || "a definir"}`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          client_id: data.id,
          message: `Lead "${data.name}" criado com sucesso`,
        });
      }

      case "update_lead": {
        const { client_id, ...updateFields } = args;
        const cleanFields: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(updateFields)) {
          if (v !== undefined && v !== null) cleanFields[k] = v;
        }

        const { error } = await supabase
          .from("clients")
          .update(cleanFields)
          .eq("id", client_id);

        if (error) throw error;

        return JSON.stringify({
          success: true,
          message: `Lead atualizado com: ${Object.keys(cleanFields).join(", ")}`,
        });
      }

      case "search_vehicles": {
        let query = supabase
          .from("vehicles")
          .select(
            "id, brand, model, year, km, estimated_value, is_financed, status, clients(name)"
          )
          .eq("status", "current");

        if (args.brand) {
          query = query.ilike("brand", `%${args.brand}%`);
        }
        if (args.max_value) {
          query = query.lte("estimated_value", args.max_value as number);
        }
        if (args.min_value) {
          query = query.gte("estimated_value", args.min_value as number);
        }

        const { data, error } = await query.limit(10);
        if (error) throw error;

        if (!data || data.length === 0) {
          return JSON.stringify({
            success: true,
            vehicles: [],
            message:
              "Nenhum veículo encontrado com esses critérios no estoque atual",
          });
        }

        return JSON.stringify({
          success: true,
          vehicles: data.map((v) => ({
            brand: v.brand,
            model: v.model,
            year: v.year,
            km: v.km,
            estimated_value: v.estimated_value,
            is_financed: v.is_financed,
          })),
          total: data.length,
        });
      }

      case "log_interaction": {
        const { error } = await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "system",
          content: args.content as string,
          created_by: "ai-consultant",
        });

        if (error) throw error;
        return JSON.stringify({ success: true });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    console.error(`Tool ${name} error:`, err);
    return JSON.stringify({
      error: `Erro ao executar ${name}: ${(err as Error).message}`,
    });
  }
}

// ── System prompt ──
const SYSTEM_PROMPT = `Você é o **Consultor Arsenal**, o atendente virtual da Arsenal Motors — uma loja de motos novas e seminovas.

## SUA PERSONALIDADE
- Você é REAL. Nunca diga que é uma IA, chatbot ou assistente virtual.
- Seu nome é Consultor Arsenal (ou só "Arsenal" quando for se apresentar de forma casual)
- Você é consultivo e empático: ESCUTA primeiro, ENTENDE a necessidade, depois oferece soluções
- Use linguagem NATURAL e informal brasileira (gírias leves, emojis moderados)
- Respostas CURTAS: 1-3 frases no máximo. Como um WhatsApp real.
- Demonstre INTERESSE genuíno pela pessoa
- Use quebra de linhas naturais, como alguém digitando no WhatsApp

## SEU OBJETIVO
1. Entender o que a pessoa precisa (comprar, trocar, vender, refinanciar)
2. Coletar informações NATURALMENTE durante a conversa (nome, telefone, orçamento, entrada, troca, crédito)
3. Criar o lead no sistema assim que tiver nome + telefone
4. Buscar veículos no estoque quando souber o perfil
5. Qualificar o lead para a equipe de vendas

## DADOS QUE VOCÊ PRECISA COLETAR (de forma natural, não interrogatório!)
- Nome
- Telefone/WhatsApp
- Interesse (comprar/trocar/vender/refinanciar)
- Faixa de orçamento
- Tem moto pra dar na troca?
- Tem entrada? Quanto?
- Crédito limpo?

## REGRAS DE OURO
1. NUNCA faça mais de uma pergunta por mensagem
2. NUNCA invente preços — use a ferramenta search_vehicles para ver o estoque real
3. Assim que tiver NOME + TELEFONE, use create_lead imediatamente
4. Quando descobrir mais dados, use update_lead para atualizar
5. Quando souber o perfil, use search_vehicles para buscar opções
6. Se a pessoa mandar "oi", "olá" etc., responda de forma calorosa e pergunte como pode ajudar
7. Use log_interaction para eventos importantes (agendou visita, pediu proposta, etc.)
8. Não use markdown pesado (sem headers #, sem listas longas). Fale como no WhatsApp.
9. Se não tiver motos no estoque que casam, diga que vai verificar com a equipe

## FLUXO IDEAL
1. Cumprimentar → "E aí! Tudo bem? Sou o consultor da Arsenal Motors 🏍️ Como posso te ajudar?"
2. Escutar a necessidade
3. Fazer perguntas naturais, UMA de cada vez
4. Quando tiver nome+telefone → create_lead
5. Quando souber o perfil → search_vehicles
6. Apresentar opções reais do estoque
7. Direcionar para ação (agendar visita, enviar proposta)

## INFORMAÇÕES DA LOJA
- Arsenal Motors — Loja de motos novas e seminovas
- Todas as marcas (Honda, Yamaha, Suzuki, Kawasaki, BMW, etc.)
- Financiamento em até 48x
- Aceita motos na troca
- Avaliação gratuita
- Horário: Seg-Sáb 8h às 18h`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY)
      throw new Error("LOVABLE_API_KEY is not configured");

    // Build messages with context
    const systemContent =
      SYSTEM_PROMPT +
      (context?.clientId
        ? `\n\n## CONTEXTO ATUAL\nLead já criado com ID: ${context.clientId}. Use update_lead para atualizar.`
        : "");

    let aiMessages: Array<{ role: string; content?: string; tool_call_id?: string; name?: string }> = [
      { role: "system", content: systemContent },
      ...messages,
    ];

    // Tool calling loop (max 3 iterations to prevent infinite loops)
    for (let i = 0; i < 3; i++) {
      const toolResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: aiMessages,
            tools,
            stream: false,
          }),
        }
      );

      if (!toolResponse.ok) {
        if (toolResponse.status === 429) {
          return new Response(
            JSON.stringify({
              error: "Muitas requisições, tente novamente em breve.",
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        if (toolResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos de IA esgotados." }),
            {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        const t = await toolResponse.text();
        console.error("AI gateway error:", toolResponse.status, t);
        throw new Error("AI gateway error");
      }

      const result = await toolResponse.json();
      const choice = result.choices?.[0];

      if (!choice) throw new Error("No response from AI");

      const toolCalls = choice.message?.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        // No tool calls — we have the final response, now stream it
        break;
      }

      // Process tool calls
      aiMessages.push(choice.message);

      for (const tc of toolCalls) {
        const args = JSON.parse(tc.function.arguments);
        console.log(`Executing tool: ${tc.function.name}`, args);
        const toolResult = await executeTool(tc.function.name, args);
        console.log(`Tool result: ${toolResult}`);

        aiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResult,
        });
      }

      // Continue loop to get final response after tool execution
    }

    // Final streaming response
    const streamResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          stream: true,
        }),
      }
    );

    if (!streamResponse.ok) {
      const t = await streamResponse.text();
      console.error("Stream error:", streamResponse.status, t);
      throw new Error("Failed to stream response");
    }

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
