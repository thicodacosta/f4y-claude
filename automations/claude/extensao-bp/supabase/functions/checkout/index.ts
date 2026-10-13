// Checkout Candydate: único para todos os canais (página de assinatura, site,
// extensões), para teste, cupom e assinatura valerem igual em todo lugar.
//
//   GET  ?plano=bp|recruiter[&cupom=X]    → dados do plano / valida o cupom
//   POST { acao: "teste" | "assinar", plano, nome, email, cpf, telefone, cupom? }
//     teste   → teste gratuito (100 mil tokens ou 3 dias), uma vez por e-mail e por CPF
//     assinar → com cupom gratuito válido: libera na hora; sem cupom: cria o
//               cliente e a assinatura no Asaas e devolve a fatura para pagar
//               (a liberação segue pelo asaas-webhook ao confirmar)
import { admin, cpfValido, emTeste, iniciarTeste, liberar, PRODUTOS_VALIDOS, salvarCliente, telefoneValido, TESTE, temProduto } from "../_shared/acesso.ts";

const PLANOS: Record<string, { nome: string; preco: string; valor: number; link: string }> = {
  bp: { nome: "Business Partner", preco: "R$ 129,90/mês", valor: 129.9, link: "https://www.asaas.com/000/c/bjiv8fc18w63r89y" },
  recruiter: { nome: "Recruiter", preco: "R$ 99,90/mês", valor: 99.9, link: "https://www.asaas.com/000/c/5p8qk8zbmdkndtwy" },
};
const env = (k: string, padrao = "") => Deno.env.get(k) ?? padrao;
const ASAAS_API = env("ASAAS_API_URL", "https://api.asaas.com/v3").replace(/\/$/, "");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
};
const json = (dados: unknown, status = 200) => Response.json(dados, { status, headers: CORS });
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DESCRICAO: Record<string, string> = { gratuito: "Acesso gratuito, sem cobrança e sem prazo." };
const USOS_POR_IP_24H = Number(env("CUPOM_USOS_POR_IP_24H", "3"));

type Cupom = { codigo: string; tipo: string; produtos: string[]; ativo: boolean; valido_ate: string | null; limite_total: number | null };

async function validar(codigo: string, plano: string): Promise<{ ok: true; cupom: Cupom } | { ok: false; motivo: string }> {
  const { data: cupom } = await admin.from("cupons").select("*").eq("codigo", codigo.trim().toUpperCase()).maybeSingle();
  if (!cupom || !cupom.ativo) return { ok: false, motivo: "Cupom inválido ou expirado." };
  if (cupom.valido_ate && cupom.valido_ate < new Date().toISOString().slice(0, 10)) return { ok: false, motivo: "Este cupom expirou." };
  if (!cupom.produtos.includes(plano)) return { ok: false, motivo: `Este cupom não vale para o plano ${PLANOS[plano].nome}.` };
  if (cupom.limite_total) {
    const { count } = await admin.from("cupom_usos").select("id", { count: "exact", head: true }).eq("cupom", cupom.codigo);
    if ((count ?? 0) >= cupom.limite_total) return { ok: false, motivo: "Este cupom já atingiu o limite de usos." };
  }
  return { ok: true, cupom };
}

/** Resumo do IP (o IP em si não é guardado). */
async function hashIp(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "desconhecido";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`candydate:${ip}`));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function asaas<T>(caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`${ASAAS_API}${caminho}`, {
    method: corpo ? "POST" : "GET",
    headers: { access_token: env("ASAAS_API_KEY"), "Content-Type": "application/json", "User-Agent": "candydate-checkout" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Asaas ${caminho}: ${r.status} ${JSON.stringify(dados).slice(0, 300)}`);
  return dados as T;
}

const hojeBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

/** Cliente e assinatura mensal no Asaas; devolve a fatura da 1ª cobrança. */
async function criarAssinatura(c: { nome: string; email: string; cpf: string; telefone: string }, plano: string) {
  const existentes = await asaas<{ data: { id: string }[] }>(`/customers?cpfCnpj=${c.cpf}`);
  const clienteId =
    existentes.data?.[0]?.id ??
    (await asaas<{ id: string }>("/customers", { name: c.nome, cpfCnpj: c.cpf, email: c.email, mobilePhone: c.telefone, externalReference: c.email })).id;
  const assinatura = await asaas<{ id: string }>("/subscriptions", {
    customer: clienteId,
    billingType: "CREDIT_CARD",
    value: PLANOS[plano].valor,
    nextDueDate: hojeBrasilia(),
    cycle: "MONTHLY",
    description: `Candydate | Plano ${PLANOS[plano].nome}`,
    externalReference: plano, // o asaas-webhook libera o produto por esta referência
  });
  const cobrancas = await asaas<{ data: { invoiceUrl: string }[] }>(`/subscriptions/${assinatura.id}/payments`);
  return { clienteId, fatura: cobrancas.data?.[0]?.invoiceUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const plano = url.searchParams.get("plano") ?? "";
      const codigo = url.searchParams.get("cupom") ?? "";
      if (!PLANOS[plano]) return json({ ok: false, motivo: "Plano inválido." }, 400);
      if (!codigo) return json({ ok: true, plano: { id: plano, nome: PLANOS[plano].nome, preco: PLANOS[plano].preco }, teste: TESTE });
      const v = await validar(codigo, plano);
      const validade = v.ok && v.cupom.valido_ate ? ` Use até ${v.cupom.valido_ate.split("-").reverse().join("/")}.` : "";
      return json(v.ok ? { ok: true, cupom: v.cupom.codigo, tipo: v.cupom.tipo, descricao: `${DESCRICAO[v.cupom.tipo]}${validade}` } : v, v.ok ? 200 : 404);
    }
    if (req.method !== "POST") return json({ ok: false, motivo: "Método não permitido." }, 405);

    const corpo = await req.json().catch(() => ({}));
    const acao = String(corpo.acao ?? "assinar");
    const plano = String(corpo.plano ?? "");
    const email = String(corpo.email ?? "").trim().toLowerCase();
    const nome = String(corpo.nome ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
    const cpf = cpfValido(String(corpo.cpf ?? ""));
    const telefone = telefoneValido(String(corpo.telefone ?? ""));
    const codigo = String(corpo.cupom ?? "").trim().toUpperCase();
    if (!PLANOS[plano] || !PRODUTOS_VALIDOS.has(plano)) return json({ ok: false, motivo: "Escolha um plano." }, 400);
    if (nome.split(" ").length < 2) return json({ ok: false, motivo: "Informe o nome completo." }, 400);
    if (!EMAIL.test(email) || email.length > 254) return json({ ok: false, motivo: "Informe um e-mail válido." }, 400);
    if (!cpf) return json({ ok: false, motivo: "Informe um CPF válido." }, 400);
    if (!telefone) return json({ ok: false, motivo: "Informe um telefone com DDD." }, 400);
    // Já tem acesso: só pode seguir quem está no teste e quer assinar.
    if ((await temProduto(email, plano)) && (acao === "teste" || !(await emTeste(email, plano)))) {
      return json({ ok: false, motivo: `Este e-mail já tem acesso ao ${PLANOS[plano].nome}. É só entrar na extensão.` }, 409);
    }

    // Teste gratuito.
    if (acao === "teste") {
      const r = await iniciarTeste(email, nome, cpf, plano);
      if (!r.ok) return json(r, 409);
      await salvarCliente({ email, nome, cpf, telefone });
      return json({ ok: true, acao: "teste", novaConta: r.novaConta, plano: PLANOS[plano].nome, teste: TESTE });
    }

    // Cupom gratuito.
    if (codigo) {
      const v = await validar(codigo, plano);
      if (!v.ok) return json(v, 422);
      const ip = await hashIp(req);
      const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: recentes } = await admin.from("cupom_usos").select("id", { count: "exact", head: true }).eq("cupom", v.cupom.codigo).eq("ip_hash", ip).gte("criado_em", desde);
      if ((recentes ?? 0) >= USOS_POR_IP_24H) return json({ ok: false, motivo: "Limite de usos deste cupom atingido nesta conexão. Tente novamente amanhã ou fale com a Candydate." }, 429);
      const { error: uso } = await admin.from("cupom_usos").insert({ cupom: v.cupom.codigo, email, nome, produto: plano, ip_hash: ip });
      if (uso) {
        if (uso.code === "23505") return json({ ok: false, motivo: "Este e-mail já usou este cupom neste plano." }, 409);
        throw uso;
      }
      try {
        await salvarCliente({ email, nome, cpf, telefone });
        const r = await liberar(email, nome, plano, { origem: "cupom", cupom: v.cupom.codigo });
        return json({ ok: true, acao: "liberado", novaConta: r.novaConta, plano: PLANOS[plano].nome });
      } catch (e) {
        await admin.from("cupom_usos").delete().eq("cupom", v.cupom.codigo).eq("email", email).eq("produto", plano);
        throw e;
      }
    }

    // Assinatura paga: cliente e assinatura no Asaas, já com os dados preenchidos.
    try {
      const { clienteId, fatura } = await criarAssinatura({ nome, email, cpf, telefone }, plano);
      await salvarCliente({ email, nome, cpf, telefone, asaas_cliente: clienteId });
      if (fatura) return json({ ok: true, acao: "pagar", link: fatura });
    } catch (e) {
      console.error("assinatura pela API do Asaas falhou; usando o link de pagamento", e);
    }
    await salvarCliente({ email, nome, cpf, telefone });
    return json({ ok: true, acao: "pagar", link: PLANOS[plano].link });
  } catch (e) {
    console.error(e);
    return json({ ok: false, motivo: "Não foi possível concluir agora. Tente novamente em instantes." }, 500);
  }
});
