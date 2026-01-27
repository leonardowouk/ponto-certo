import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pin } = await req.json();

    if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: 'PIN inválido. Deve ter 6 dígitos.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const pin_hash = await bcrypt.hash(pin, salt);

    return new Response(
      JSON.stringify({ pin_hash }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[hash-pin] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
