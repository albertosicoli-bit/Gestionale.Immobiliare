import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bank-hook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("it-IT").replace(/\s+/g, " ");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  const hookSecret = Deno.env.get("BANK_WEBHOOK_SECRET");
  if (!hookSecret || request.headers.get("x-bank-hook-secret") !== hookSecret) return json({ error: "Non autorizzato" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Configurazione backend incompleta" }, 500);

  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json({ error: "JSON non valido" }, 400); }
  const messageId = String(input.message_id || "").trim();
  const senderName = String(input.sender_name || "").trim();
  const creditedOn = String(input.credited_on || "").trim();
  const amount = Number(input.amount);
  const senderKey = normalize(senderName);
  if (!messageId || !senderName || !/^\d{4}-\d{2}-\d{2}$/.test(creditedOn) || !Number.isFinite(amount) || amount <= 0) {
    return json({ error: "Dati bonifico incompleti o non validi" }, 400);
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: inserted, error: insertError } = await db.from("bank_transfer_events").insert({
    gmail_message_id: messageId, sender_name: senderName, sender_key: senderKey,
    credited_on: creditedOn, amount: Math.round(amount * 100) / 100,
    status: "review", review_reason: "In attesa di abbinamento.",
  }).select("id").single();
  let eventId = inserted?.id;
  if (insertError?.code === "23505") {
    const { data: previous, error } = await db.from("bank_transfer_events").select("id,status").eq("gmail_message_id", messageId).maybeSingle();
    if (error || !previous) return json({ error: "Impossibile rileggere il bonifico già ricevuto" }, 500);
    if (previous.status !== "unmatched") return json({ ok: true, duplicate: true });
    eventId = previous.id;
    await db.from("bank_transfer_events").update({ status: "review", review_reason: "Nuovo tentativo dopo l’abbinamento dell’ordinante." }).eq("id", eventId);
  }
  if (insertError && insertError.code !== "23505") return json({ error: insertError.message || "Registrazione non riuscita" }, 500);
  if (!eventId) return json({ error: "Registrazione non riuscita" }, 500);
  const finish = async (updates: Record<string, unknown>, result: Record<string, unknown>) => {
    const { error } = await db.from("bank_transfer_events").update(updates).eq("id", eventId);
    if (error) return json({ error: "Aggiornamento evento non riuscito" }, 500);
    return json({ ok: true, ...result });
  };

  const { data: aliases, error: aliasError } = await db.from("tenant_bank_sender_aliases").select("tenant_id,sender_name").eq("sender_key", senderKey);
  if (aliasError) return finish({ review_reason: "Errore nella lettura dell’abbinamento." }, { review: true });
  if (!aliases?.length) return finish({ sender_name: senderName, status: "unmatched", review_reason: "Ordinante non ancora associato a un inquilino." }, { unmatched: true });
  if (aliases.length !== 1) return finish({ status: "review", review_reason: "Ordinante associato a più inquilini." }, { review: true });
  const tenantId = aliases[0].tenant_id;
  const { data: payments, error: paymentError } = await db.from("rent_payments")
    .select("id,tenant_id,lease_id,period,due_date,amount_due,amount_paid,status")
    .eq("tenant_id", tenantId).in("status", ["pending", "late", "partial"]).order("due_date", { ascending: true });
  if (paymentError) return finish({ tenant_id: tenantId, review_reason: "Errore nella lettura dei canoni aperti." }, { review: true });
  const open = (payments || []).filter((p) => Number(p.amount_due) - Number(p.amount_paid || 0) > 0.004);
  const exact = open.filter((p) => Math.abs((Number(p.amount_due) - Number(p.amount_paid || 0)) - amount) < 0.005);
  if (exact.length !== 1) {
    const expected = open.length === 1 ? Math.max(0, Number(open[0].amount_due) - Number(open[0].amount_paid || 0)) : null;
    const reason = exact.length > 1 ? "Più canoni aperti hanno lo stesso importo: verifica manualmente." : open.length === 1
      ? "Importo ricevuto diverso dal canone: verifica manualmente."
      : "Non è stato trovato un unico canone aperto corrispondente.";
    return finish({ tenant_id: tenantId, expected_amount: expected, status: "review", review_reason: reason }, { review: true, expected_amount: expected });
  }
  const payment = exact[0];
  const { data: changed, error: changeError } = await db.from("rent_payments").update({
    amount_paid: Number(payment.amount_due), paid_at: creditedOn, status: "paid",
  }).eq("id", payment.id).in("status", ["pending", "late", "partial"]).select("id").maybeSingle();
  if (changeError || !changed) return finish({ tenant_id: tenantId, expected_amount: Number(payment.amount_due), status: "review", review_reason: "Il canone è cambiato durante l’aggiornamento: verifica manualmente." }, { review: true });
  return finish({ tenant_id: tenantId, payment_id: payment.id, expected_amount: Number(payment.amount_due), status: "matched", review_reason: null }, { matched: true, payment_id: payment.id });
});
