import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-token",
};

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

    const body = await req.json();
    const { name, phone, email, interest, source, city, budget_range, notes, seller_name } = body;

    if (!name || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with service_role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Create the lead
    const { data, error } = await supabase.from("clients").insert({
      name: name.trim(),
      phone: phone || null,
      email: email || null,
      interest: interest || null,
      source: source || "bot-messenger",
      city: city || null,
      budget_range: budget_range || null,
      notes: notes || null,
      status: "lead",
      temperature: "warm",
      pipeline_stage: "new",
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

    return new Response(JSON.stringify({ success: true, lead: data }), {
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
