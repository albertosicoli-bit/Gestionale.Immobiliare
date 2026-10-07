// Supabase Edge Function: crea un account inquilino/manutentore solo per un admin autenticato.
// Deploy: supabase functions deploy admin-create-user

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Metodo non supportato" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return response({ error: "Autorizzazione mancante" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } }
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return response({ error: "Sessione non valida" }, 401);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: actor, error: actorError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (actorError || actor?.role !== "admin") return response({ error: "Operazione riservata all’amministratore" }, 403);

    const payload = await request.json();
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const displayName = String(payload.display_name || "").trim();
    const phone = String(payload.phone || "").trim();
    const role = payload.role === "provider" ? "provider" : "tenant";

    if (!email || !displayName || password.length < 8) {
      return response({ error: "Nome, email e una password di almeno 8 caratteri sono obbligatori" }, 400);
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, phone }
    });
    if (createError || !created.user) return response({ error: createError?.message || "Creazione account non riuscita" }, 400);

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ role, display_name: displayName, email, phone })
      .eq("id", created.user.id);
    if (profileError) return response({ error: profileError.message }, 500);

    return response({ id: created.user.id, email, role });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Errore inatteso" }, 500);
  }
});
