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
          cpf: { type: "string", description: "CPF number (Brazilian ID)" },
          marital_status: {
            type: "string",
            enum: ["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"],
            description: "Marital status",
          },
          salary: { type: "number", description: "Monthly income in BRL" },
          employer: { type: "string", description: "Where they work" },
          employment_time: { type: "string", description: "How long at current job" },
          position: { type: "string", description: "Job title/position" },
          reference_name: { type: "string", description: "Personal reference full name" },
          reference_phone: { type: "string", description: "Personal reference phone" },
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
          cpf: { type: "string", description: "CPF number" },
          marital_status: {
            type: "string",
            enum: ["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"],
          },
          reference_name: { type: "string", description: "Personal reference full name" },
          reference_phone: { type: "string", description: "Personal reference phone" },
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
        "Simulate a financing plan using Aqui Financiamentos rate table (Moto Leve). Uses coeficientes based on vehicle year and number of installments. Call when discussing parcelas, entrada, and payment options.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          vehicle_value: { type: "number", description: "Total vehicle value in BRL" },
          down_payment: { type: "number", description: "Down payment amount in BRL" },
          installments: { type: "number", description: "Number of installments (12, 18, 24, 36, 48)" },
          vehicle_year: { type: "number", description: "Year of the vehicle being financed. Affects rate. Use current year for 0km." },
          coeficiente: {
            type: "string",
            enum: ["A", "B", "C"],
            description: "Credit coeficiente/rating. A=best rate (good credit), B=medium, C=higher risk. Default A.",
          },
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
      name: "check_documents",
      description:
        "Check the financing document checklist for a client. Returns which documents have been submitted and which are still pending. Use this to show the client a visual checklist of what's needed.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
        },
        required: ["client_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detect_urgency",
      description:
        "Detect and update lead urgency/temperature based on buying signals. Call this when the client expresses urgency like 'preciso pra essa semana', 'é urgente', 'quero fechar hoje', 'tenho pressa', 'minha moto quebrou', 'preciso trabalhar'. Also call when client shows cold signals like 'só estou olhando', 'vou pensar', 'depois eu vejo'.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          urgency_level: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
            description: "critical=needs NOW, high=this week, medium=interested, low=just browsing",
          },
          reason: { type: "string", description: "Why this urgency level was detected" },
        },
        required: ["client_id", "urgency_level", "reason"],
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
  {
    type: "function",
    function: {
      name: "save_conversation_notes",
      description:
        "Save a structured summary of ALL relevant information collected during the conversation. Call this EVERY FEW MESSAGES with a cumulative summary. Include: preferences, objections, personal details mentioned, family situation, work context, buying timeline, anything useful for future sales.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          notes: {
            type: "string",
            description: "Structured notes with all relevant info collected. Use bullet points. Example: '• Prefere motos esportivas\n• Trabalha como entregador, precisa da moto pra trabalhar\n• Esposa também anda de moto\n• Quer parcela até R$500\n• Mora perto da loja\n• Tem medo de financiar por já ter tido nome sujo'",
          },
        },
        required: ["client_id", "notes"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "process_cnh_data",
      description:
        "Process CNH (driver's license) data extracted from a photo or text. Automatically registers the birthdate, full name, and CPF in the lead profile, marks CNH as received in financing docs, and adds the client to the birthday alerts system. Call this whenever the client shares CNH information — either by photo OCR results or by providing CNH details in text.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "Client UUID" },
          full_name: { type: "string", description: "Full name as on CNH" },
          cpf: { type: "string", description: "CPF number from CNH" },
          birthdate: { type: "string", description: "Birth date in YYYY-MM-DD format from CNH" },
          cnh_number: { type: "string", description: "CNH number" },
          birth_city: { type: "string", description: "City of birth from CNH" },
        },
        required: ["client_id"],
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
            cpf: (args.cpf as string) || null,
            marital_status: (args.marital_status as string) || null,
            salary: (args.salary as number) || null,
            employer: (args.employer as string) || null,
            employment_time: (args.employment_time as string) || null,
            position: (args.position as string) || null,
            reference_name: (args.reference_name as string) || null,
            reference_phone: (args.reference_phone as string) || null,
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
          .from("stock_vehicles")
          .select("id, brand, model, year, km, color, price, condition, status, description, features")
          .eq("status", "available");

        if (args.brand) {
          query = query.ilike("brand", `%${args.brand}%`);
        }
        if (args.max_value) {
          query = query.lte("price", args.max_value as number);
        }
        if (args.min_value) {
          query = query.gte("price", args.min_value as number);
        }

        const { data, error } = await query.order("price", { ascending: true }).limit(10);
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
            color: v.color,
            price: v.price,
            condition: v.condition === "new" ? "0km" : "Seminova",
            description: v.description,
            features: v.features,
          })),
          total: data.length,
          display_hint: "Apresente cada moto em formato visual com emojis: 🏍️ Marca Modelo Ano, condição, km, cor, preço em negrito. Use simulate_financing para cada opção relevante.",
        });
      }

      case "simulate_financing": {
        const vehicleValue = args.vehicle_value as number;
        const downPayment = (args.down_payment as number) || 0;
        const numInstallments = (args.installments as number) || 48;
        const financed = vehicleValue - downPayment;
        const vehicleYear = (args.vehicle_year as number) || new Date().getFullYear();
        const coef = (args.coeficiente as string) || "A";

        // Aqui Financiamentos - Moto Leve rate table (coeficientes por parcela)
        // Rates based on vehicle age and credit rating
        // Coeficiente = valor da parcela por R$1.000 financiado
        const currentYear = new Date().getFullYear();
        const vehicleAge = currentYear - vehicleYear;

        // Rate table: coeficiente per R$1 financed (multiply by financed amount to get monthly payment)
        // Based on Aqui Financiamentos Moto Leve typical rates
        const rateTable: Record<string, Record<number, number>> = {
          // Coeficiente A (melhor crédito)
          "A": {
            12: vehicleAge <= 3 ? 0.09800 : vehicleAge <= 8 ? 0.10100 : 0.10500,
            18: vehicleAge <= 3 ? 0.07200 : vehicleAge <= 8 ? 0.07450 : 0.07800,
            24: vehicleAge <= 3 ? 0.05850 : vehicleAge <= 8 ? 0.06050 : 0.06350,
            36: vehicleAge <= 3 ? 0.04450 : vehicleAge <= 8 ? 0.04650 : 0.04900,
            48: vehicleAge <= 3 ? 0.03800 : vehicleAge <= 8 ? 0.04000 : 0.04250,
          },
          // Coeficiente B (crédito médio)
          "B": {
            12: vehicleAge <= 3 ? 0.10200 : vehicleAge <= 8 ? 0.10500 : 0.10900,
            18: vehicleAge <= 3 ? 0.07500 : vehicleAge <= 8 ? 0.07750 : 0.08100,
            24: vehicleAge <= 3 ? 0.06100 : vehicleAge <= 8 ? 0.06350 : 0.06650,
            36: vehicleAge <= 3 ? 0.04700 : vehicleAge <= 8 ? 0.04950 : 0.05200,
            48: vehicleAge <= 3 ? 0.04050 : vehicleAge <= 8 ? 0.04300 : 0.04550,
          },
          // Coeficiente C (maior risco)
          "C": {
            12: vehicleAge <= 3 ? 0.10600 : vehicleAge <= 8 ? 0.10900 : 0.11300,
            18: vehicleAge <= 3 ? 0.07850 : vehicleAge <= 8 ? 0.08100 : 0.08450,
            24: vehicleAge <= 3 ? 0.06400 : vehicleAge <= 8 ? 0.06700 : 0.07000,
            36: vehicleAge <= 3 ? 0.05000 : vehicleAge <= 8 ? 0.05300 : 0.05600,
            48: vehicleAge <= 3 ? 0.04350 : vehicleAge <= 8 ? 0.04650 : 0.04950,
          },
        };

        const coefTable = rateTable[coef] || rateTable["A"];

        // Get rate for selected installments (default to closest available)
        const availableInstallments = [12, 18, 24, 36, 48];
        const closest = availableInstallments.reduce((prev, curr) =>
          Math.abs(curr - numInstallments) < Math.abs(prev - numInstallments) ? curr : prev
        );

        const selectedCoef = coefTable[closest] || coefTable[48];
        const monthly = financed * selectedCoef;

        // Calculate all options for comparison
        const options = availableInstallments.map(n => {
          const c = coefTable[n];
          const m = financed * c;
          return {
            installments: n,
            monthly_payment: Math.round(m * 100) / 100,
            total: Math.round(m * n * 100) / 100,
            total_interest: Math.round((m * n - financed) * 100) / 100,
            coeficiente: c,
          };
        });

        // Estimate equivalent monthly rate from coeficiente
        const estimatedRate = selectedCoef > 0 ? Math.round(((monthly * closest / financed) - 1) / closest * 10000) / 100 : 0;

        // Save simulation
        const selectedMonthly = Math.round(monthly * 100) / 100;
        await supabase.from("financing_simulations").insert({
          client_id: args.client_id as string,
          moto_value: vehicleValue,
          down_payment: downPayment,
          financed_amount: financed,
          months: closest,
          monthly_payment: selectedMonthly,
          total_interest: Math.round((monthly * closest - financed) * 100) / 100,
          interest_rate: selectedCoef,
          source: "ai-chat",
          status: "pending",
        });

        await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "system",
          content: `Simulação Aqui Financiamentos (Moto Leve, Coef. ${coef}): Veículo ${vehicleYear} R$ ${vehicleValue.toLocaleString()}, Entrada R$ ${downPayment.toLocaleString()}, ${closest}x de R$ ${selectedMonthly}`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          simulation: {
            vehicle_value: vehicleValue,
            vehicle_year: vehicleYear,
            vehicle_age: vehicleAge,
            down_payment: downPayment,
            financed_amount: financed,
            coeficiente: coef,
            selected_plan: {
              installments: closest,
              monthly_payment: selectedMonthly,
              coeficiente_used: selectedCoef,
            },
            all_options: options,
            rate_info: `Tabela Aqui Financiamentos — Moto Leve, Coef. ${coef} (idade do veículo: ${vehicleAge} anos)`,
            display_hint: `Mostre em tabela markdown com colunas: Parcelas | Valor | Total Pago | Juros. Inclua:
- Banco: Aqui Financiamentos
- Método: Moto Leve
- Coeficiente: ${coef}
- Ano do veículo: ${vehicleYear}
- Entrada e valor financiado abaixo da tabela
- Nota: *Valores sujeitos a análise de crédito. Coeficiente pode variar.*`,
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

      case "check_documents": {
        const { data: client } = await supabase
          .from("clients")
          .select("financing_docs, name, cpf, salary, employer, reference_name, reference_phone, marital_status")
          .eq("id", args.client_id)
          .single();

        if (!client) return JSON.stringify({ error: "Client not found" });

        const docs = (client.financing_docs as Record<string, boolean>) || {};
        const checklist = {
          cnh: { label: "CNH / RG + CPF", done: !!docs.cnh },
          pay_stub: { label: "Comprovante de Renda (holerite)", done: !!docs.pay_stub },
          proof_of_residence: { label: "Comprovante de Residência", done: !!docs.proof_of_residence },
          reference: { label: "Referência Pessoal", done: !!(client.reference_name && client.reference_phone) },
          cpf_info: { label: "CPF informado", done: !!client.cpf },
          income_info: { label: "Renda informada", done: !!client.salary },
          employer_info: { label: "Empresa/Empregador", done: !!client.employer },
          marital_info: { label: "Estado civil", done: !!client.marital_status },
        };

        const total = Object.keys(checklist).length;
        const done = Object.values(checklist).filter(c => c.done).length;
        const percent = Math.round((done / total) * 100);

        return JSON.stringify({
          success: true,
          checklist,
          progress: { done, total, percent },
          display_hint: `Mostre o checklist assim em markdown:

📋 **Checklist de Financiamento** (${percent}%)
${"▓".repeat(Math.round(percent / 10))}${"░".repeat(10 - Math.round(percent / 10))} ${percent}%

${Object.values(checklist).map(c => `${c.done ? "✅" : "⬜"} ${c.label}`).join("\n")}

Se faltam itens, pergunte o próximo dado pendente de forma natural.`,
        });
      }

      case "detect_urgency": {
        const urgencyMap: Record<string, { temperature: string; priority: number; pipeline: string }> = {
          critical: { temperature: "hot", priority: 10, pipeline: "interested" },
          high: { temperature: "hot", priority: 8, pipeline: "interested" },
          medium: { temperature: "warm", priority: 5, pipeline: "contacted" },
          low: { temperature: "cold", priority: 3, pipeline: "contacted" },
        };

        const config = urgencyMap[args.urgency_level as string] || urgencyMap.medium;

        await supabase
          .from("clients")
          .update({
            temperature: config.temperature,
            last_contact_at: new Date().toISOString(),
          })
          .eq("id", args.client_id);

        // Create urgency task for critical/high
        if (args.urgency_level === "critical" || args.urgency_level === "high") {
          await supabase.from("tasks").insert({
            client_id: args.client_id as string,
            type: "follow_up",
            reason: `🚨 Lead URGENTE: ${args.reason}`,
            due_date: new Date().toISOString().split("T")[0],
            priority: config.priority,
            source: "ai-chat",
            status: "pending",
          });
        }

        await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "system",
          content: `Urgência detectada: ${args.urgency_level} — ${args.reason}. Temperatura: ${config.temperature}`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          urgency: args.urgency_level,
          temperature: config.temperature,
          message: args.urgency_level === "critical"
            ? "Lead URGENTE! Priorize atendimento máximo, ofereça opções prontas para retirada imediata."
            : args.urgency_level === "low"
            ? "Lead apenas olhando. Mantenha engajamento sem pressionar."
            : "Urgência registrada.",
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

      case "save_conversation_notes": {
        // Get existing notes to append
        const { data: existingClient } = await supabase
          .from("clients")
          .select("notes")
          .eq("id", args.client_id)
          .single();

        const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const newNotes = `\n\n--- Anotação IA (${timestamp}) ---\n${args.notes}`;
        const combinedNotes = (existingClient?.notes || "") + newNotes;

        const { error } = await supabase
          .from("clients")
          .update({ notes: combinedNotes })
          .eq("id", args.client_id);

        if (error) throw error;

        await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "system",
          content: `📝 Notas da conversa salvas automaticamente pela IA`,
          created_by: "ai-consultant",
        });

        return JSON.stringify({
          success: true,
          message: "Notas salvas no perfil do cliente.",
        });
      }

      case "process_cnh_data": {
        const updateData: Record<string, unknown> = {};
        const logParts: string[] = [];

        if (args.full_name) {
          updateData.name = args.full_name;
          logParts.push(`Nome: ${args.full_name}`);
        }
        if (args.cpf) {
          updateData.cpf = args.cpf;
          logParts.push(`CPF: ${args.cpf}`);
        }
        if (args.birthdate) {
          updateData.birthdate = args.birthdate;
          logParts.push(`Nascimento: ${args.birthdate}`);
        }
        if (args.birth_city) {
          updateData.birth_city = args.birth_city;
          logParts.push(`Naturalidade: ${args.birth_city}`);
        }

        // Mark CNH as received in financing_docs
        const { data: clientData } = await supabase
          .from("clients")
          .select("financing_docs")
          .eq("id", args.client_id)
          .single();

        const docs = (clientData?.financing_docs as Record<string, boolean>) || {
          cnh: false, pay_stub: false, proof_of_residence: false, reference: false
        };
        docs.cnh = true;
        updateData.financing_docs = docs;
        logParts.push("CNH: ✅ recebida");

        // Update client
        const { error } = await supabase
          .from("clients")
          .update(updateData)
          .eq("id", args.client_id);

        if (error) throw error;

        // Log interaction
        await supabase.from("interactions").insert({
          client_id: args.client_id as string,
          type: "system",
          content: `🪪 CNH processada automaticamente:\n${logParts.join("\n")}${args.birthdate ? "\n🎂 Cliente adicionado aos alertas de aniversário!" : ""}`,
          created_by: "ai-consultant",
        });

        // If we have a birthdate, check if birthday is today or this month
        let birthdayMessage = "";
        if (args.birthdate) {
          const bd = new Date(args.birthdate + "T12:00:00");
          const today = new Date();
          if (bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate()) {
            birthdayMessage = "🎂 HOJE é aniversário do cliente! Parabenize-o!";
          } else if (bd.getMonth() === today.getMonth()) {
            birthdayMessage = `🎂 Aniversário este mês (dia ${bd.getDate()})!`;
          }
        }

        return JSON.stringify({
          success: true,
          processed: logParts,
          birthday_alert: birthdayMessage || null,
          message: `CNH processada! Dados atualizados: ${logParts.join(", ")}. ${args.birthdate ? "Cliente cadastrado nos alertas de aniversário automaticamente. " : ""}${birthdayMessage}`,
        });
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

### Fase 2 — Qualificação COMPLETA para financiamento (conduza ativamente!)
Depois de criar o lead, colete TODOS estes dados um a um, de forma natural:
- **CPF**: "Me passa seu CPF pra eu já adiantar a pré-análise de crédito"
- **Data de nascimento**: "Qual sua data de nascimento? Preciso pro cadastro"
- **Estado civil**: "Você é casado(a), solteiro(a)...?"
- **Cidade**: "Você é de onde?"
- **Orçamento**: "Mais ou menos quanto tá pensando em investir?"
- **Entrada**: "Tem algum valor pra dar de entrada?"
- **Crédito**: "Seu nome tá limpo no SPC/Serasa?"
- **Troca**: "Tem moto pra dar na troca?"
  → Se sim: marca, modelo, ano, km, se é financiada → register_trade_in
- **Empregador/Empresa**: "Você trabalha onde? Empresa, autônomo...?"
- **Cargo**: "Qual seu cargo/função?"
- **Tempo de empresa**: "Há quanto tempo trabalha lá?"
- **Renda mensal**: "Mais ou menos quanto é sua renda mensal? Pergunto pra ver qual parcela cabe no seu bolso"
- **Referência pessoal**: "Me passa o nome e telefone de uma referência pessoal — pode ser parente ou amigo. É exigência do banco pra financiamento"

IMPORTANTE: A cada informação nova → use update_lead IMEDIATAMENTE. NADA se perde!

### Fase 3 — Apresentação com simulação inline
Quando tiver perfil suficiente (pelo menos orçamento ou interesse em moto específica):
1. Use search_vehicles para buscar opções REAIS do estoque
2. Apresente 2-3 opções formatadas assim:

**🏍️ Honda CG 160 Titan 2024**
📍 Seminova · 8.500 km · Preta
💰 **R$ 15.900**

3. Use simulate_financing para cada opção e mostre:

📊 **Simulação de Financiamento:**
| Parcelas | Valor |
|----------|-------|
| 12x | R$ 1.580 |
| 24x | R$ 890 |
| 36x | R$ 670 |
| 48x | R$ 560 |
*Entrada: R$ 3.000 · Taxa: 1,89% a.m.*

4. Compare: "Com sua renda de R$ X, a parcela de R$ Y representa Z% — super tranquilo!"

### Fase 4 — Fechamento (conduzir para ação)
- "Quer que eu reserve essa pra você?"
- "Bora agendar pra você vir ver pessoalmente?"
- "Posso mandar uma proposta completa no seu WhatsApp?"
- Use schedule_visit quando o cliente topar

### Fase 5 — Checklist de documentos
Quando o cliente decidir financiar ou após coletar dados suficientes:
1. Use check_documents para verificar o progresso
2. Mostre o checklist visual retornado pela ferramenta
3. Pergunte pelo próximo item pendente
4. Diga: "Você pode enviar a foto dos documentos aqui mesmo que eu analiso na hora! 📸"

## DETECÇÃO AUTOMÁTICA DE URGÊNCIA
SEMPRE use detect_urgency quando detectar sinais de compra:

**Sinais CRÍTICOS (urgency=critical):**
- "preciso pra hoje", "é urgente", "minha moto quebrou", "preciso trabalhar", "não tenho como ir trabalhar", "acidente", "roubaram minha moto"

**Sinais ALTOS (urgency=high):**
- "quero fechar essa semana", "já tenho a entrada pronta", "vim decidido", "quero resolver logo", "preciso pra semana que vem"

**Sinais MÉDIOS (urgency=medium):**
- "tô interessado", "gostei dessa", "quanto fica", "me manda proposta"

**Sinais BAIXOS (urgency=low):**
- "só estou olhando", "vou pensar", "depois eu vejo", "tô pesquisando ainda", "não tenho pressa"

Para leads CRÍTICOS: priorize motos pronta-entrega, ofereça atendimento expresso, sugira retirada no mesmo dia.
Para leads ALTOS: crie senso de oportunidade, mostre condições especiais.

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
11. Apresente veículos em formato visual com emojis e tabelas markdown
12. Sempre calcule % da renda quando souber o salário: "A parcela representa X% da sua renda"
13. Colete CPF, estado civil e referência pessoal — são OBRIGATÓRIOS para financiamento
14. Use detect_urgency SEMPRE que detectar sinais de urgência ou desinteresse
15. Use check_documents quando discutir financiamento para mostrar progresso visual

## 📝 ANOTAÇÕES AUTOMÁTICAS (IMPORTANTÍSSIMO!)
Você DEVE usar save_conversation_notes a cada 3-4 mensagens trocadas com o cliente.
Anote TUDO que for relevante, incluindo:
- Preferências pessoais (cor, marca, estilo de moto)
- Objeções e medos ("medo de financiar", "parcela muito alta")
- Situação familiar (esposa, filhos, dependentes)
- Contexto profissional (usa moto pra trabalho, entregador, etc)
- Timeline de compra ("preciso pra semana que vem", "sem pressa")
- Detalhes pessoais mencionados (hobbies, viagens, etc)
- Motivo da troca/compra
- Qualquer informação que ajude em vendas futuras

Formato das notas: use bullet points (•) com categorias claras.
As notas são CUMULATIVAS — inclua tudo que já sabe + novas informações.

## 🪪 PROCESSAMENTO AUTOMÁTICO DE CNH
Quando o cliente enviar foto da CNH ou informar dados da CNH:
1. Use process_cnh_data IMEDIATAMENTE com todos os dados visíveis
2. Isso automaticamente:
   - Atualiza nome completo, CPF, data de nascimento e naturalidade
   - Marca CNH como ✅ no checklist de documentos
   - Cadastra o cliente nos alertas de aniversário
3. Confirme ao cliente: "Já peguei todos os seus dados da CNH! ✅"
4. Se for aniversário do cliente hoje ou neste mês, parabenize!

Se o cliente mencionar data de nascimento em qualquer contexto:
- Use update_lead com birthdate IMEDIATAMENTE
- Isso já cadastra automaticamente nos aniversariantes

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

    // Track client_id and vehicles found during tool calls
    let createdClientId: string | null = null;
    let foundVehicles: unknown[] = [];

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

        // Track vehicles from search_vehicles
        if (tc.function.name === "search_vehicles") {
          try {
            const parsed = JSON.parse(toolResult);
            if (parsed.vehicles?.length) foundVehicles = parsed.vehicles;
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

    // If we have metadata (client_id or vehicles), prepend SSE events
    const hasMetadata = createdClientId || foundVehicles.length > 0;
    if (hasMetadata) {
      const metaPayload: Record<string, unknown> = {};
      if (createdClientId) metaPayload.client_id = createdClientId;
      if (foundVehicles.length > 0) metaPayload.vehicles = foundVehicles;

      const metaEvent = `data: ${JSON.stringify({ metadata: metaPayload })}\n\n`;
      const encoder = new TextEncoder();
      const metaStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(metaEvent));
          const reader = streamResponse.body!.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        },
      });
      return new Response(metaStream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
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
