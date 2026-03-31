import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-token",
};

// In-memory rate limiting (resets on cold start, good enough for edge)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100; // max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(token: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(token);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(token, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate bot token
    const botToken = req.headers.get("x-bot-token");
    const expectedToken = Deno.env.get("BOT_SECRET_TOKEN");

    if (!expectedToken || botToken !== expectedToken) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting
    if (!checkRateLimit(botToken)) {
      return new Response(JSON.stringify({ error: "Rate limit excedido. Máximo 100 leads/hora." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" },
      });
    }

    const body = await req.json();
    const { name, phone, email, interest, source, city, budget_range, notes, seller_name, local_vehicle_id } = body;

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (name.trim().length > 255) {
      return new Response(JSON.stringify({ error: "Nome muito longo (máx 255 caracteres)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize phone (keep only digits and +)
    const sanitizedPhone = phone ? String(phone).replace(/[^\d+]/g, "").slice(0, 20) : null;

    // Create Supabase client with service_role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Deduplication by phone — if phone exists, return existing lead
    if (sanitizedPhone && sanitizedPhone.length >= 8) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id, name, phone, pipeline_stage, created_at")
        .eq("phone", sanitizedPhone)
        .limit(1)
        .single();

      if (existing) {
        return new Response(JSON.stringify({
          success: true,
          duplicate: true,
          message: `Lead já existe: ${existing.name}`,
          lead: existing,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Lookup vehicle by local_bot_id if provided
    let vehicleUuid: string | null = null;
    if (local_vehicle_id && typeof local_vehicle_id === "string") {
      const sanitizedVehicleId = local_vehicle_id.trim().slice(0, 20);
      const { data: vehicle } = await supabase
        .from("stock_vehicles")
        .select("id")
        .eq("local_bot_id", sanitizedVehicleId)
        .limit(1)
        .single();
      if (vehicle) {
        vehicleUuid = vehicle.id;
      }
    }

    // Create the lead
    const { data, error } = await supabase.from("clients").insert({
      name: name.trim().slice(0, 255),
      phone: sanitizedPhone,
      email: email ? String(email).trim().slice(0, 255) : null,
      interest: interest ? String(interest).slice(0, 500) : null,
      source: source ? String(source).slice(0, 50) : "bot-messenger",
      city: city ? String(city).slice(0, 100) : null,
      budget_range: budget_range ? String(budget_range).slice(0, 50) : null,
      notes: notes ? String(notes).slice(0, 1000) : null,
      status: "lead",
      temperature: "warm",
      pipeline_stage: "new",
      vehicle_id: vehicleUuid,
    }).select().single();

    if (error) {
      console.error("Erro ao criar lead:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log in bot_logs if seller/bot config provided
    if (seller_name) {
      const { data: botConfig } = await supabase
        .from("bot_configs")
        .select("id")
        .eq("seller_name", seller_name)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (botConfig) {
        await supabase.from("bot_logs").insert({
          bot_config_id: botConfig.id,
          event_type: "lead_created",
          platform: source || "messenger",
          contact_name: name,
          message_in: interest || null,
          lead_created: true,
          client_id: data.id,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, duplicate: false, lead: data }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
