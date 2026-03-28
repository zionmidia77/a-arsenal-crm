import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { image_base64, action } = await req.json();

    if (!image_base64 || typeof image_base64 !== 'string') {
      return new Response(JSON.stringify({ error: 'Imagem é obrigatória' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Call AI to extract data from image
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiResponse = await fetch('https://ai.lovable.dev/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente que extrai dados de contato de screenshots de conversas.
Analise a imagem e extraia TODOS os dados que conseguir identificar.
Responda APENAS com JSON válido no formato:
{
  "name": "nome completo ou null",
  "phone": "telefone com DDD ou null",
  "email": "email ou null",
  "city": "cidade ou null",
  "interest": "interesse identificado ou null",
  "budget_range": "faixa de orçamento ou null",
  "notes": "resumo da conversa e outros dados relevantes (CPF, CNH, etc)",
  "source": "facebook",
  "confidence": "high/medium/low"
}
Se encontrar CNH, CPF ou outros documentos, inclua nos notes.
Para interesse, use uma dessas opções se possível: "Quero comprar uma moto", "Quero trocar minha moto", "Quero vender minha moto", "Preciso de dinheiro".
Para budget_range, use: "Até R$ 15 mil", "R$ 15 a 30 mil", "R$ 30 a 50 mil", "Acima de R$ 50 mil".`
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: image_base64.startsWith('data:') ? image_base64 : `data:image/jpeg;base64,${image_base64}`
                }
              },
              {
                type: 'text',
                text: 'Extraia todos os dados de contato e informações relevantes desta conversa/imagem.'
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI error:', errText);
      return new Response(JSON.stringify({ error: 'Erro ao processar imagem com IA' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content || '{}';
    
    let extracted;
    try {
      extracted = JSON.parse(extractedText);
    } catch {
      return new Response(JSON.stringify({ error: 'IA retornou formato inválido', raw: extractedText }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If action is "extract_only", just return the data
    if (action === 'extract_only') {
      return new Response(JSON.stringify({ extracted }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action "create": create the lead
    if (!extracted.name) {
      return new Response(JSON.stringify({ 
        error: 'Não foi possível identificar o nome na imagem',
        extracted 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if lead with same phone already exists
    let existingClient = null;
    if (extracted.phone) {
      const cleanPhone = extracted.phone.replace(/\D/g, '');
      const { data } = await supabase
        .from('clients')
        .select('*')
        .or(`phone.eq.${extracted.phone},phone.eq.${cleanPhone}`)
        .limit(1);
      if (data && data.length > 0) {
        existingClient = data[0];
      }
    }

    if (existingClient) {
      // Update existing client with new info
      const updates: Record<string, any> = {};
      if (extracted.city && !existingClient.city) updates.city = extracted.city;
      if (extracted.email && !existingClient.email) updates.email = extracted.email;
      if (extracted.interest && !existingClient.interest) updates.interest = extracted.interest;
      if (extracted.budget_range && !existingClient.budget_range) updates.budget_range = extracted.budget_range;
      if (extracted.notes) {
        updates.notes = (existingClient.notes ? existingClient.notes + '\n---\n' : '') + 
          `[Foto ${new Date().toLocaleDateString('pt-BR')}] ${extracted.notes}`;
      }

      if (Object.keys(updates).length > 0) {
        const { data, error } = await supabase
          .from('clients')
          .update(updates)
          .eq('id', existingClient.id)
          .select()
          .single();
        if (error) throw error;
        
        // Log interaction
        await supabase.from('interactions').insert({
          client_id: existingClient.id,
          type: 'system',
          content: `Lead atualizado via captura de foto. Dados extraídos: ${extracted.notes || 'sem notas adicionais'}`,
          created_by: 'ai-photo'
        });

        return new Response(JSON.stringify({ 
          action: 'updated',
          client: data,
          extracted 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        action: 'already_exists',
        client: existingClient,
        extracted 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create new lead
    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert({
        name: extracted.name,
        phone: extracted.phone || null,
        email: extracted.email || null,
        city: extracted.city || null,
        interest: extracted.interest || null,
        budget_range: extracted.budget_range || null,
        notes: extracted.notes || null,
        source: extracted.source || 'facebook',
        status: 'lead',
        temperature: 'warm',
        pipeline_stage: 'new',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ 
      action: 'created',
      client: newClient,
      extracted 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
