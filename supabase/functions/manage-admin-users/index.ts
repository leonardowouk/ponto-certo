import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is admin
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    
    const isAdmin = callerRoles?.some(r => ["admin", "super_admin"].includes(r.role));
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuperAdmin = callerRoles?.some(r => r.role === "super_admin");
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (await req.json().catch(() => ({})))?.action;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    if (action === "list") {
      // Get all users with admin/rh/gestor roles
      const { data: roleEntries } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role");

      if (!roleEntries || roleEntries.length === 0) {
        return new Response(JSON.stringify({ users: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userIds = [...new Set(roleEntries.map(r => r.user_id))];
      
      // Get company access
      const { data: companyAccess } = await supabaseAdmin
        .from("user_company_access")
        .select("user_id, company_id, companies(nome)");

      // Get auth users
      const users = [];
      for (const uid of userIds) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(uid);
        if (user) {
          const userRoles = roleEntries.filter(r => r.user_id === uid).map(r => r.role);
          const userCompanies = (companyAccess || [])
            .filter(ca => ca.user_id === uid)
            .map(ca => ({ company_id: ca.company_id, nome: (ca.companies as any)?.nome }));
          
          users.push({
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            roles: userRoles,
            companies: userCompanies,
          });
        }
      }

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { email, password, role, company_ids } = body;
      
      if (!email || !password || !role) {
        return new Response(JSON.stringify({ error: "Email, senha e role são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only super_admin can create super_admin users
      if (role === "super_admin" && !isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Apenas super admin pode criar super admins" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Add role
      await supabaseAdmin.from("user_roles").insert({
        user_id: newUser.user.id,
        role,
      });

      // Add company access
      if (company_ids && company_ids.length > 0 && role !== "super_admin") {
        const accessRows = company_ids.map((cid: string) => ({
          user_id: newUser.user.id,
          company_id: cid,
        }));
        await supabaseAdmin.from("user_company_access").insert(accessRows);
      }

      return new Response(JSON.stringify({ user: { id: newUser.user.id, email: newUser.user.email } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { user_id, role, company_ids } = body;
      
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent self-demotion
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode alterar seu próprio papel" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (role) {
        if (role === "super_admin" && !isSuperAdmin) {
          return new Response(JSON.stringify({ error: "Apenas super admin pode definir super admins" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Replace roles
        await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
        await supabaseAdmin.from("user_roles").insert({ user_id, role });
      }

      if (company_ids !== undefined) {
        await supabaseAdmin.from("user_company_access").delete().eq("user_id", user_id);
        if (company_ids.length > 0) {
          const accessRows = company_ids.map((cid: string) => ({
            user_id,
            company_id: cid,
          }));
          await supabaseAdmin.from("user_company_access").insert(accessRows);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode remover a si mesmo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      await supabaseAdmin.from("user_company_access").delete().eq("user_id", user_id);
      await supabaseAdmin.auth.admin.deleteUser(user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
