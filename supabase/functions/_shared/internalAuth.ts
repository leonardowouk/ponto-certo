// Shared authentication helpers for scheduled / internal edge functions.
// A caller is accepted when it presents the internal job secret (cron jobs and
// server-to-server calls) or a valid admin/RH session token.

// deno-lint-ignore no-explicit-any
type Client = any;

export async function getInternalSecret(supabase: Client): Promise<string | null> {
  const { data } = await supabase
    .from('internal_job_secrets')
    .select('value')
    .eq('name', 'cron')
    .maybeSingle();
  return data?.value ?? null;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True when the request carries the internal job secret. */
export async function hasInternalSecret(req: Request, supabase: Client): Promise<boolean> {
  const provided = req.headers.get('x-internal-secret') || '';
  if (!provided) return false;
  const expected = await getInternalSecret(supabase);
  if (!expected) return false;
  return safeEqual(provided, expected);
}

/** True when the request carries a session token of an admin/RH user. */
export async function isAdminOrRhCaller(req: Request, supabase: Client): Promise<boolean> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return false;
  const { data: ok } = await supabase.rpc('is_admin_or_rh', { _user_id: data.user.id });
  return !!ok;
}

/**
 * Returns null when the caller is allowed, or a 401 Response otherwise.
 */
export async function requireInternalCaller(
  req: Request,
  supabase: Client,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (await hasInternalSecret(req, supabase)) return null;
  if (await isAdminOrRhCaller(req, supabase)) return null;
  return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
