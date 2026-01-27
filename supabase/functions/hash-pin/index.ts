import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple hash function using Web Crypto API (available in Edge Runtime)
async function hashPin(pin: string): Promise<string> {
  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Encode the pin with salt
  const encoder = new TextEncoder();
  const data = encoder.encode(saltHex + pin);
  
  // Hash using SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Return salt + hash (so we can verify later)
  return `${saltHex}:${hashHex}`;
}

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

    const pin_hash = await hashPin(pin);

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
