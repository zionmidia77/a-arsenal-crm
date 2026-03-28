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
            description: "Budget range e.g. 'R$ 15 a 30 mil', 'Acima de R$ 50 mil'",
          },
          has_trade_in: {
            type: "boolean",
            description: "Has a vehicle to trade in",
          },
          has_clean_credit: {
            type: "boolean",
            description: "Has clean credit (nome limpo) for financing",
          },
          has_down_payment: {
            type: "boolean",
            description: "Has money for down payment (entrada)",
          },
          down_payment_amount: {
            type: "number",
            description: "Down payment amount in BRL",
          },
          city: { type: "string", description: "City where client lives" },
          birthdate: {
            type: "string",
            description: "Birth date in YYYY-MM-DD format",
          },
          email: { type: "string", description: "Email address" },
          payment_type: {
            type: "string",
            enum: ["financing", "cash", "consortium"],
            description: "Preferred payment method",
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
        "Update an existing lead with new information collected during conversation. Call this EVERY TIME you learn something new about the client.",
      parameters: {
        type: "object",
        properties: {
          client_id: {
            type: "string",
            description: "The UUID of the lead to update",
          },
          interest: { type: "string", description: "comprar, trocar, vender, refinanciar" },
          budget_range: { type: "string", description: "e.g. 'R$ 15 a 30 mil'" },
          has_trade_in: { type: "boolean" },
          has_clean_credit: { type: "boolean" },
          has_down_payment: { type: "boolean" },
          down_payment_amount: { type: "number" },
          city: { type: "string" },
          birthdate: { type: "string", description: "YYYY-MM-DD" },
          employer: { type: "string", description: "Where they work" },
          employment_time: { type: "string", description: "How long at current job e.g. '2 anos'" },
          position: { type: "string", description: "Job title/position" },
          salary: { type: "number", description: "Monthly income in BRL" },
          email: { type: "string" },
          payment_type: {
            type: "string",
            enum: ["financing", "cash", "consortium"],
          },
          notes: { type: "string", description: "Important notes about the client's situation" },
          pipeline_stage: {
            type: "string",
            enum: ["new", "contacted", "interested", "negotiating", "scheduled"],
            description: "Move lead through pipeline as conversation progresses",
          },
          temperature: {
            type: "string",
            enum: ["hot", "warm", "cold"],
            description: "Lead temperature based on buying intent",
          },
        },
        required: ["client_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "register_trade_in",
      description:
        "Register a vehicle the client wants to trade in. Captures details for evaluation. Call when client says they have a moto to give as entrada/troca.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          brand: { type: "string", description: "Vehicle brand (Honda, Yamaha, etc.)" },
          model: { type: "string", description: "Vehicle model (CG 160, Factor, etc.)" },
          year: { type: "number", description: "Vehicle year" },
          km: { type: "number", description: "Approximate kilometers" },
          is_financed: { type: "boolean", description: "Is the vehicle still being financed?" },
          installments_paid: { type: "number", description: "How many installments paid if financed" },
          installments_total: { type: "number", description: "Total installments if financed" },
          monthly_payment: { type: "number", description: "Monthly payment if financed" },
          estimated_value: { type: "number", description: "Client's estimated value" },
        },
        required: ["client_id", "brand", "model"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_vehicles",
      description:
        "Search available vehicles in the inventory. Use to recommend options matching the client's profile and budget.",
      parameters: {
        type: "object",
        properties: {
          brand: {
            type: "string",
            description: "Brand filter (e.g. Honda, Yamaha)",
          },
          max_value: {
            type: "number",
            description: "Maximum estimated value in BRL",
          },
          min_value: {
            type: "number",
            description: "Minimum estimated value in BRL",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "simulate_financing",
      description:
        "Simulate a financing plan for the client. Use when discussing parcelas, entrada, and payment options.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          vehicle_value: { type: "number", description: "Total vehicle value in BRL" },
          down_payment: { type: "number", description: "Down payment amount in BRL" },
          installments: { type: "number", description: "Number of installments (12, 24, 36, 48)" },
        },
        required: ["client_id", "vehicle_value"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_visit",
      description:
        "Schedule a visit to the store or a call with the sales team. Use when the client is ready to move forward.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          visit_type: {
            type: "string",
            enum: ["store_visit", "video_call", "phone_call", "evaluation"],
            description: "Type of appointment",
          },
          preferred_date: { type: "string", description: "Preferred date (YYYY-MM-DD)" },
          preferred_time: { type: "string", description: "Preferred time (HH:MM)" },
          notes: { type: "string", description: "Any special notes about the visit" },
        },
        required: ["client_id", "visit_type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_whatsapp_proposal",
      description:
        "Generate and send a financing proposal via WhatsApp when the client approves the simulation. Creates a formatted proposal message with all details and generates a wa.me link. Call this ONLY after the client says they want to proceed with the financing.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          client_name: { type: "string", description: "Client's name" },
          client_phone: { type: "string", description: "Client's phone number" },
          vehicle_description: { type: "string", description: "Vehicle brand + model + year" },
          vehicle_value: { type: "number", description: "Total vehicle value in BRL" },
          down_payment: { type: "number", description: "Down payment amount in BRL" },
          installments: { type: "number", description: "Number of installments chosen" },
          monthly_payment: { type: "number", description: "Monthly payment amount in BRL" },
          has_trade_in: { type: "boolean", description: "Client has a trade-in vehicle" },
          trade_in_description: { type: "string", description: "Trade-in vehicle description if applicable" },
          trade_in_value: { type: "number", description: "Estimated trade-in value if applicable" },
          additional_notes: { type: "string", description: "Any additional notes about the deal" },
        },
        required: ["client_id", "client_name", "client_phone", "vehicle_description", "vehicle_value", "installments", "monthly_payment"],
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
            down_payment_amount: (args.down_payment_amount as number) || null,
            city: (args.city as string) || null,
            birthdate: (args.birthdate as string) || null,
            email: (args.email as string) || null,
            payment_type: (args.payment_type as string) || null,
            source: "ai-chat",
            status: "lead",
            temperature: "hot",
            pipeline_stage: "new",
          })
          .select("id, name")
          .single();

        if (error) throw error;

        await supabase.from("interactions").insert({
          client_id: data.id,
          type: "system",
          content: `Lead criado via chat IA. Interesse: ${args.interest || "a definir"}`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          client_id: data.id,
          message: `Lead "${data.name}" criado com sucesso. IMPORTANTE: Use este client_id (${data.id}) em TODAS as chamadas futuras de update_lead, register_trade_in, simulate_financing, schedule_visit e log_interaction.`,
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
          .update({ ...cleanFields, last_contact_at: new Date().toISOString() })
          .eq("id", client_id);

        if (error) throw error;

        // Log what was updated
        await supabase.from("interactions").insert({
          client_id: client_id as string,
          type: "system",
          content: `Dados atualizados via chat IA: ${Object.keys(cleanFields).join(", ")}`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          message: `Lead atualizado com: ${Object.keys(cleanFields).join(", ")}`,
        });
      }

      case "register_trade_in": {
        const { client_id, ...vehicleData } = args;

        // Update client's has_trade_in flag
        await supabase
          .from("clients")
          .update({ has_trade_in: true })
          .eq("id", client_id);

        // Register the trade-in vehicle
        const { data, error } = await supabase
          .from("vehicles")
          .insert({
            client_id: client_id as string,
            brand: vehicleData.brand as string,
            model: vehicleData.model as string,
            year: (vehicleData.year as number) || null,
            km: (vehicleData.km as number) || null,
            is_financed: (vehicleData.is_financed as boolean) || false,
            installments_paid: (vehicleData.installments_paid as number) || 0,
            installments_total: (vehicleData.installments_total as number) || 0,
            monthly_payment: (vehicleData.monthly_payment as number) || null,
            estimated_value: (vehicleData.estimated_value as number) || null,
            status: "current",
          })
          .select("id")
          .single();

        if (error) throw error;

        await supabase.from("interactions").insert({
          client_id: client_id as string,
          type: "system",
          content: `Moto de troca registrada: ${vehicleData.brand} ${vehicleData.model}${vehicleData.year ? ` ${vehicleData.year}` : ""}${vehicleData.is_financed ? " (financiada)" : ""}`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          vehicle_id: data.id,
          message: `Moto ${vehicleData.brand} ${vehicleData.model} registrada para avaliação de troca.`,
        });
      }

      case "search_vehicles": {
        let query = supabase
          .from("vehicles")
          .select(
            "id, brand, model, year, km, estimated_value, is_financed, status"
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
            message: "Nenhum veículo encontrado com esses critérios no estoque atual. Diga ao cliente que vai verificar com a equipe e entrar em contato.",
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

      case "simulate_financing": {
        const vehicleValue = args.vehicle_value as number;
        const downPayment = (args.down_payment as number) || 0;
        const numInstallments = (args.installments as number) || 48;
        const financed = vehicleValue - downPayment;
        const rate = 0.0189; // 1.89% monthly rate (market average for motos)
        const monthly = financed * (rate * Math.pow(1 + rate, numInstallments)) / (Math.pow(1 + rate, numInstallments) - 1);

        // Also calculate other options
        const options = [12, 24, 36, 48].map(n => {
          const m = financed * (rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
          return { installments: n, monthly_payment: Math.round(m * 100) / 100 };
        });

        await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "system",
          content: `Simulação de financiamento: Veículo R$ ${vehicleValue.toLocaleString()}, Entrada R$ ${downPayment.toLocaleString()}, ${numInstallments}x de R$ ${Math.round(monthly * 100) / 100}`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          simulation: {
            vehicle_value: vehicleValue,
            down_payment: downPayment,
            financed_amount: financed,
            selected_plan: {
              installments: numInstallments,
              monthly_payment: Math.round(monthly * 100) / 100,
            },
            all_options: options,
            rate_info: "Taxa de 1.89% a.m. (sujeita a análise de crédito)",
          },
        });
      }

      case "schedule_visit": {
        // Create a task for the visit
        const visitLabels: Record<string, string> = {
          store_visit: "Visita à loja",
          video_call: "Videochamada",
          phone_call: "Ligação",
          evaluation: "Avaliação de moto",
        };
        const label = visitLabels[args.visit_type as string] || "Agendamento";

        const { error } = await supabase.from("tasks").insert({
          client_id: args.client_id as string,
          type: "follow_up",
          reason: `📅 ${label} agendada${args.preferred_date ? ` para ${args.preferred_date}` : ""}${args.preferred_time ? ` às ${args.preferred_time}` : ""}${args.notes ? ` — ${args.notes}` : ""}`,
          due_date: (args.preferred_date as string) || new Date().toISOString().split("T")[0],
          scheduled_time: (args.preferred_time as string) || null,
          priority: 9,
          source: "ai-chat",
          status: "pending",
        });

        if (error) throw error;

        // Update pipeline stage
        await supabase
          .from("clients")
          .update({ pipeline_stage: "scheduled", temperature: "hot" })
          .eq("id", args.client_id);

        await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "system",
          content: `${label} agendada via chat IA${args.preferred_date ? ` para ${args.preferred_date}` : ""}${args.preferred_time ? ` às ${args.preferred_time}` : ""}`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          message: `${label} agendada com sucesso!`,
        });
      }

      case "send_whatsapp_proposal": {
        const clientName = args.client_name as string;
        const phone = (args.client_phone as string).replace(/\D/g, "");
        const vehicle = args.vehicle_description as string;
        const value = args.vehicle_value as number;
        const dp = (args.down_payment as number) || 0;
        const inst = args.installments as number;
        const monthly = args.monthly_payment as number;
        const hasTradeIn = args.has_trade_in as boolean;
        const tradeDesc = (args.trade_in_description as string) || "";
        const tradeValue = (args.trade_in_value as number) || 0;
        const notes = (args.additional_notes as string) || "";

        // Format the proposal message
        const today = new Date().toLocaleDateString("pt-BR");
        let proposalMsg = `🏍️ *PROPOSTA ARSENAL MOTORS*\n`;
        proposalMsg += `📅 ${today}\n\n`;
        proposalMsg += `Olá, *${clientName}*! Segue sua proposta:\n\n`;
        proposalMsg += `🏷️ *Veículo:* ${vehicle}\n`;
        proposalMsg += `💰 *Valor:* R$ ${value.toLocaleString("pt-BR")}\n`;
        if (dp > 0) {
          proposalMsg += `💵 *Entrada:* R$ ${dp.toLocaleString("pt-BR")}\n`;
        }
        if (hasTradeIn && tradeDesc) {
          proposalMsg += `🔄 *Troca:* ${tradeDesc}`;
          if (tradeValue > 0) proposalMsg += ` (avaliação: R$ ${tradeValue.toLocaleString("pt-BR")})`;
          proposalMsg += `\n`;
        }
        proposalMsg += `📊 *Financiamento:* ${inst}x de R$ ${monthly.toLocaleString("pt-BR")}\n`;
        proposalMsg += `📈 *Taxa:* 1.89% a.m. (sujeita a análise)\n\n`;
        if (notes) proposalMsg += `📝 ${notes}\n\n`;
        proposalMsg += `✅ *Próximos passos:*\n`;
        proposalMsg += `1. Análise de crédito (resposta em até 2h)\n`;
        proposalMsg += `2. Documentação\n`;
        proposalMsg += `3. Retirada da moto! 🎉\n\n`;
        proposalMsg += `_Arsenal Motors — Sua moto dos sonhos está aqui!_\n`;
        proposalMsg += `📞 Horário: Seg-Sáb 8h às 18h`;

        // Generate WhatsApp link
        const phoneFormatted = phone.startsWith("55") ? phone : `55${phone}`;
        const waLink = `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(proposalMsg)}`;

        // Save proposal as message sent
        await supabase.from("messages_sent").insert({
          client_id: args.client_id as string,
          message_content: proposalMsg,
          channel: "whatsapp",
        });

        // Update pipeline stage
        await supabase
          .from("clients")
          .update({
            pipeline_stage: "negotiating",
            temperature: "hot",
            has_down_payment: dp > 0,
            down_payment_amount: dp > 0 ? dp : null,
            payment_type: "financing",
            last_contact_at: new Date().toISOString(),
          })
          .eq("id", args.client_id);

        // Log interaction
        await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "whatsapp",
          content: `Proposta de financiamento enviada via WhatsApp: ${vehicle} — ${inst}x de R$ ${monthly}`,
          created_by: "ai-consultant",
        });

        // Create follow-up task
        await supabase.from("tasks").insert({
          client_id: args.client_id as string,
          type: "follow_up",
          reason: `📋 Acompanhar proposta enviada: ${vehicle} — ${inst}x de R$ ${monthly}`,
          due_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
          priority: 9,
          source: "ai-chat",
          status: "pending",
        });

        return JSON.stringify({
          success: true,
          whatsapp_link: waLink,
          message: `Proposta gerada! Link do WhatsApp pronto. Diga ao cliente que a proposta será enviada no WhatsApp dele. Inclua o link na sua resposta assim: [📲 Abrir proposta no WhatsApp](${waLink})`,
          proposal_summary: `${vehicle} — Entrada R$ ${dp.toLocaleString("pt-BR")} + ${inst}x de R$ ${monthly}`,
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
const SYSTEM_PROMPT = `Você é o **Consultor Arsenal**, vendedor real da Arsenal Motors — uma loja de motos novas e seminovas.

## SUA IDENTIDADE
- Você é um VENDEDOR DE VERDADE. Nunca diga que é IA, chatbot ou assistente virtual.
- Seu nome é Arsenal (forma casual) ou Consultor Arsenal
- Você é PROATIVO: não espera o cliente pedir, você CONDUZ a conversa
- Linguagem NATURAL, informal brasileira, como WhatsApp real
- Respostas CURTAS: 1-3 frases. Nada de textão.
- Emojis moderados, naturais

## SEU OBJETIVO PRINCIPAL
Você é um CLOSER. Seu objetivo é:
1. Entender a necessidade → conduzir para a VENDA
2. Coletar TODOS os dados para o CRM (cada dado = oportunidade futura de venda)
3. Qualificar o lead para financiamento
4. Apresentar opções reais do estoque
5. FECHAR: agendar visita, enviar proposta, ou marcar avaliação de troca

## ESTRATÉGIA DE COLETA DE DADOS (faça naturalmente!)

### Fase 1 — Identificação (primeiras mensagens)
- Nome e telefone → create_lead IMEDIATAMENTE
- O que procura (comprar/trocar/vender/refinanciar)

### Fase 2 — Qualificação (conduzir ativamente)
Depois de criar o lead, CONDUZA a conversa para descobrir:
- **Orçamento**: "Mais ou menos quanto você tá pensando em investir?"
- **Entrada**: "Você tem algum valor pra dar de entrada?"
- **Troca**: "Tem moto pra dar na troca? Se tiver, a gente faz avaliação grátis!"
  → Se sim: pergunte marca, modelo, ano, km, se é financiada
  → Use register_trade_in para salvar
- **Crédito**: "Seu nome tá limpo? Pra gente já ver as melhores condições de financiamento"
- **Profissão**: "Você trabalha em quê? Pergunto porque algumas empresas têm convênio"
- **Cidade**: "Você é de onde? Pra gente ver a melhor forma de atender"
- **Data de nascimento**: "Me passa sua data de nascimento pra eu completar seu cadastro aqui"

### Fase 3 — Apresentação (quando tiver perfil)
- Use search_vehicles para buscar opções REAIS
- Use simulate_financing para mostrar parcelas
- Apresente 2-3 opções que casem com o perfil
- Compare: "Essa aqui cabe no seu bolso: R$ X de entrada + 48x de R$ Y"

### Fase 4 — Fechamento (conduzir para ação)
- "Quer que eu reserve essa pra você?"
- "Bora agendar pra você vir ver pessoalmente?"
- "Posso mandar uma proposta completa no seu WhatsApp?"
- Use schedule_visit quando o cliente topar

## REGRAS DE OURO
1. NUNCA faça mais de UMA pergunta por mensagem
2. NUNCA invente preços — use search_vehicles e simulate_financing
3. Assim que tiver NOME + TELEFONE → create_lead IMEDIATO
4. A CADA nova informação → update_lead (NADA se perde!)
5. Se o cliente tem moto pra troca → register_trade_in com todos os dados
6. Quando souber o perfil → search_vehicles + simulate_financing
7. Use log_interaction para: agendou visita, pediu proposta, interessou em moto específica
8. CONDUZA a conversa — não espere o cliente perguntar
9. Seja CONSULTIVO: "Com esse perfil, a melhor opção pra você é..."
10. Se não tem no estoque → "Vou verificar com minha equipe e te retorno!"

## QUANDO O CLIENTE DIZ "SÓ ESTOU OLHANDO"
- Não desista! "Tranquilo! Me conta o que você curte, posso te mostrar umas opções legais que chegaram"
- Mostre entusiasmo pela moto que ele mencionar
- Crie URGÊNCIA sutil: "Essa aqui tá saindo rápido..."

## DADOS QUE GERAM RECEITA FUTURA (capte TODOS!)
Cada dado no CRM é uma oportunidade:
- Aniversário → oferta especial
- Profissão/empresa → convênio corporativo
- Cidade → eventos regionais
- Moto atual → lembrete de revisão, upgrade
- Família (casado, filhos) → segunda moto, moto pro filho
- Email → newsletter com ofertas

## FLUXO DE FINANCIAMENTO
Quando o cliente quer financiar:
1. Pergunte valor de entrada
2. Pergunte se nome está limpo
3. Use simulate_financing para mostrar opções de parcela
4. Apresente: "Com entrada de R$ X, fica 48x de R$ Y"
5. Se o cliente APROVAR/TOPAR → use send_whatsapp_proposal IMEDIATAMENTE
6. Diga: "Pronto! Mandei a proposta completa no seu WhatsApp 📲"
7. Em seguida → schedule_visit para finalizar

## ENVIO DE PROPOSTA VIA WHATSAPP
- Quando o cliente demonstrar interesse na simulação (disse "quero", "pode ser", "tá bom", "manda", "vamos", "fecha", "gostei"), use send_whatsapp_proposal
- NÃO espere o cliente pedir explicitamente — seja proativo!
- Após enviar, SEMPRE inclua o link do WhatsApp na resposta usando markdown: [📲 Abrir proposta no WhatsApp](link)
- O link abre o WhatsApp do cliente com a proposta formatada pronta pra enviar
- Isso move o lead para "Negociando" no pipeline automaticamente
- Uma tarefa de follow-up é criada automaticamente para o dia seguinte

## INFORMAÇÕES DA LOJA
- Arsenal Motors — Motos novas e seminovas
- Todas as marcas (Honda, Yamaha, Suzuki, Kawasaki, BMW, etc.)
- Financiamento em até 48x com as melhores taxas
- Aceita motos na troca (avaliação gratuita!)
- Consórcio disponível
- Horário: Seg-Sáb 8h às 18h
- Primeira revisão GRÁTIS para quem comprar aqui`;

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
        ? `\n\n## CONTEXTO ATUAL\nLead já criado com ID: ${context.clientId}. Use update_lead para atualizar. NÃO crie outro lead.`
        : "");

    let aiMessages: Array<{ role: string; content?: string; tool_call_id?: string; name?: string }> = [
      { role: "system", content: systemContent },
      ...messages,
    ];

    // Track client_id created during tool calls
    let createdClientId: string | null = null;

    // Tool calling loop (max 5 iterations for complex flows)
    for (let i = 0; i < 5; i++) {
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
            JSON.stringify({ error: "Muitas requisições, tente novamente em breve." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (toolResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos de IA esgotados." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

      if (!toolCalls || toolCalls.length === 0) break;

      aiMessages.push(choice.message);

      for (const tc of toolCalls) {
        const args = JSON.parse(tc.function.arguments);
        console.log(`Executing tool: ${tc.function.name}`, args);
        const toolResult = await executeTool(tc.function.name, args);
        console.log(`Tool result: ${toolResult}`);

        // Track client_id from create_lead
        if (tc.function.name === "create_lead") {
          try {
            const parsed = JSON.parse(toolResult);
            if (parsed.client_id) createdClientId = parsed.client_id;
          } catch {}
        }

        aiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResult,
        });
      }
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
