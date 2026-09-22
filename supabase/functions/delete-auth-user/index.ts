import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Método não permitido" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    const caller = authData?.user;
    if (authError || !caller) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["admin", "super_admin"]);

    if (roleError || !roles?.length) {
      console.warn("[delete-auth-user] Unauthorized deletion attempt", { caller_id: caller.id });
      return json({ error: "Acesso negado" }, 403);
    }

    const { email } = await req.json();

    if (!isValidEmail(email)) {
      return json({ error: "Email inválido" }, 400);
    }

    // Buscar usuário pelo email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error("Erro ao listar usuários:", listError);
      return json({ error: "Erro ao buscar usuário" }, 500);
    }

    const user = users.users.find((u) => u.email === email);

    if (!user) {
      console.info("[delete-auth-user] User not found", { caller_id: caller.id });
      return json({ success: true, message: "Usuário não encontrado no auth" });
    }

    if (user.id === caller.id) {
      return json({ error: "Você não pode remover a si mesmo" }, 400);
    }

    const isSuperAdmin = roles.some((r) => r.role === "super_admin");

    if (!isSuperAdmin) {
      // Target must never be a super admin
      const { data: targetRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if ((targetRoles ?? []).some((r) => r.role === "super_admin")) {
        return json({ error: "Acesso negado" }, 403);
      }

      // Target must belong to one of the caller's companies
      const { data: callerCompanies } = await supabaseAdmin.rpc("get_user_company_ids", {
        _user_id: caller.id,
      });
      const allowed = new Set(
        (callerCompanies ?? []).map((c: unknown) =>
          typeof c === "string" ? c : (c as Record<string, string>).get_user_company_ids,
        ),
      );

      const { data: targetEmployees } = await supabaseAdmin
        .from("employees")
        .select("company_id")
        .eq("auth_user_id", user.id);
      const { data: targetAccess } = await supabaseAdmin
        .from("user_company_access")
        .select("company_id")
        .eq("user_id", user.id);

      const targetCompanies = [
        ...(targetEmployees ?? []).map((e) => e.company_id),
        ...(targetAccess ?? []).map((a) => a.company_id),
      ].filter(Boolean);

      const shares = targetCompanies.some((cid) => allowed.has(cid));
      if (!shares) {
        console.warn("[delete-auth-user] Out-of-scope deletion attempt", { caller_id: caller.id });
        return json({ error: "Usuário fora do seu escopo de empresa" }, 403);
      }
    }


    // Deletar usuário
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Erro ao deletar usuário:", deleteError);
      return json({ error: "Erro ao deletar usuário" }, 500);
    }

    console.info("[delete-auth-user] User deleted", { caller_id: caller.id, deleted_user_id: user.id });
    return json({ success: true, message: "Usuário deletado com sucesso" });
  } catch (error) {
    console.error("Erro:", error);
    return json({ error: "Erro interno" }, 500);
  }
});
