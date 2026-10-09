// Webhook do Asaas → liberação automática de acesso aos produtos Candydate.
//
// Pagamento confirmado: cria a conta (se não existir), libera o produto e
// envia o e-mail de senha provisória (o mesmo de "Esqueci a senha"); o
// cliente entra na extensão com o código e cria a própria senha.
// Vencido: marca como atrasado (a rotina diária expirar_assinaturas retira o
// acesso depois da tolerância). Cancelamento, estorno ou chargeback: retira na
// hora. Cada aviso é processado uma vez só (asaas_eventos).
//
// Segredos (Supabase › Edge Functions › Secrets):
//   ASAAS_API_KEY        chave de API do Asaas (leitura de clientes e assinaturas)
//   ASAAS_WEBHOOK_TOKEN  o mesmo "token de autenticação" cadastrado no webhook do Asaas
//   ASAAS_PRODUTOS       opcional: {"<id do link de pagamento ou referência externa>": "bp" | "recruiter"}
//   ASAAS_API_URL        opcional (padrão: produção https://api.asaas.com/v3)
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente.
import { admin, liberar as liberarAcesso, retirar } from "../_shared/acesso.ts";

const env = (k: string, padrao = "") => Deno.env.get(k) ?? padrao;
const ASAAS_API = env("ASAAS_API_URL", "https://api.asaas.com/v3").replace(/\/$/, "");
const TOKEN = env("ASAAS_WEBHOOK_TOKEN");
// Links de pagamento (assinaturas mensais) de cada produto.
const PRODUTOS: Record<string, string> = {
  bjiv8fc18w63r89y: "bp", // Plano Business Partner · R$ 129,90/mês
  "5p8qk8zbmdkndtwy": "recruiter", // Plano Recruiter · R$ 99,90/mês
  ...JSON.parse(env("ASAAS_PRODUTOS", "{}")),
};
const VALIDOS = new Set(["bp", "recruiter"]);

type Pagamento = { id: string; customer: string; subscription?: string | null; paymentLink?: string | null; externalReference?: string | null; dueDate?: string; paymentDate?: string | null; confirmedDate?: string | null };
type Assinatura = { id: string; customer: string; paymentLink?: string | null; externalReference?: string | null; description?: string | null };

async function asaas<T>(caminho: string): Promise<T> {
  const r = await fetch(`${ASAAS_API}${caminho}`, { headers: { access_token: env("ASAAS_API_KEY"), "User-Agent": "candydate-webhook" } });
  if (!r.ok) throw new Error(`Asaas ${caminho}: ${r.status}`);
  return (await r.json()) as T;
}

/** Produto pelo link de pagamento ou pela referência externa (do pagamento ou da assinatura). */
async function produtoDe(p: Partial<Pagamento>, s?: Partial<Assinatura> | null): Promise<string | null> {
  let assinatura = s ?? null;
  const direto = [p.paymentLink, p.externalReference, assinatura?.paymentLink, assinatura?.externalReference];
  for (const c of direto) if (c && (PRODUTOS[c] ?? (VALIDOS.has(c) ? c : null))) return PRODUTOS[c] ?? c;
  if (!assinatura && p.subscription) {
    assinatura = await asaas<Assinatura>(`/subscriptions/${p.subscription}`);
    for (const c of [assinatura.paymentLink, assinatura.externalReference]) if (c && (PRODUTOS[c] ?? (VALIDOS.has(c) ? c : null))) return PRODUTOS[c] ?? c;
  }
  return null;
}

async function liberar(email: string, nome: string | null, produto: string, dados: Record<string, unknown>) {
  return (await liberarAcesso(email, nome, produto, { origem: "asaas", ...dados })).resultado;
}

async function processar(ev: { event: string; payment?: Pagamento; subscription?: Assinatura }) {
  const p = ev.payment;
  const s = ev.subscription;
  const clienteId = p?.customer ?? s?.customer;
  if (!clienteId) return { resultado: "ignorado (sem cliente)" };
  const tipo = ev.event;
  const relevante = /^(PAYMENT_(CONFIRMED|RECEIVED|OVERDUE|REFUNDED|CHARGEBACK_REQUESTED|CHARGEBACK_DISPUTE)|SUBSCRIPTION_(DELETED|INACTIVATED))$/.test(tipo);
  if (!relevante) return { resultado: "ignorado (evento)" };

  const produto = await produtoDe(p ?? {}, s);
  if (!produto) return { resultado: "ignorado (link de pagamento não é de um produto Candydate)" };
  const cliente = await asaas<{ email?: string; name?: string }>(`/customers/${clienteId}`);
  const email = cliente.email?.trim().toLowerCase();
  if (!email) return { resultado: "erro: cliente sem e-mail no Asaas", produto };

  let resultado: string;
  if (tipo === "PAYMENT_CONFIRMED" || tipo === "PAYMENT_RECEIVED") {
    resultado = await liberar(email, cliente.name ?? null, produto, {
      asaas_cliente: clienteId,
      asaas_assinatura: p?.subscription ?? null,
      ultimo_pagamento: p?.confirmedDate ?? p?.paymentDate ?? new Date().toISOString().slice(0, 10),
    });
  } else if (tipo === "PAYMENT_OVERDUE") {
    const { data: atual } = await admin.from("assinaturas").select("atrasada_desde, status").eq("email", email).eq("produto", produto).maybeSingle();
    const { error } = await admin
      .from("assinaturas")
      .upsert({ email, produto, status: atual?.status === "suspensa" ? "suspensa" : "atrasada", atrasada_desde: atual?.atrasada_desde ?? p?.dueDate ?? new Date().toISOString().slice(0, 10), asaas_cliente: clienteId }, { onConflict: "email,produto" });
    if (error) throw error;
    resultado = "pagamento em atraso (acesso mantido durante a tolerância)";
  } else if (tipo.startsWith("PAYMENT_REFUNDED") || tipo.startsWith("PAYMENT_CHARGEBACK")) {
    resultado = await retirar(email, produto, "estornada");
  } else {
    resultado = await retirar(email, produto, "cancelada");
  }
  return { resultado, email, produto };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("método não permitido", { status: 405 });
  if (!TOKEN || req.headers.get("asaas-access-token") !== TOKEN) return new Response("não autorizado", { status: 401 });
  let ev: { id?: string; event: string; payment?: Pagamento; subscription?: Assinatura };
  try {
    ev = await req.json();
  } catch {
    return new Response("corpo inválido", { status: 400 });
  }
  const id = ev.id ?? `${ev.event}:${ev.payment?.id ?? ev.subscription?.id}`;
  // Idempotência: o primeiro registro do id ganha; repetições só confirmam.
  const { error: dup } = await admin.from("asaas_eventos").insert({ id, evento: ev.event, pagamento: ev.payment?.id ?? null, assinatura: ev.payment?.subscription ?? ev.subscription?.id ?? null, payload: ev });
  if (dup) {
    if (dup.code === "23505") return Response.json({ ok: true, resultado: "evento já processado" });
    console.error(dup);
    return new Response("erro ao registrar o evento", { status: 500 });
  }
  try {
    const r = await processar(ev);
    await admin.from("asaas_eventos").update({ resultado: r.resultado, email: r.email ?? null, produto: r.produto ?? null }).eq("id", id);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    console.error(e);
    // Falha temporária (ex.: API do Asaas fora): apaga o registro para o reenvio do Asaas processar de novo.
    await admin.from("asaas_eventos").delete().eq("id", id);
    return new Response("falha ao processar; o Asaas vai reenviar", { status: 500 });
  }
});
