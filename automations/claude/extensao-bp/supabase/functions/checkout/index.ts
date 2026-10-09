// Checkout Candydate (página de assinatura, site e extensões usam este mesmo
// endpoint, para o cupom valer igual em todo lugar).
//
//   GET  ?cupom=CANDYFREE&plano=bp           → valida o cupom (não consome)
//   POST { plano, nome, email, cupom? }      → com cupom gratuito válido: libera o
//        acesso na hora (conta + e-mail de senha provisória) e registra o uso;
//        sem cupom: devolve o link de pagamento do Asaas do plano (a liberação
//        segue pelo asaas-webhook quando o pagamento for confirmado).
import { admin, liberar, PRODUTOS_VALIDOS, temProduto } from "../_shared/acesso.ts";

const PLANOS: Record<string, { nome: string; preco: string; link: string }> = {
  bp: { nome: "Business Partner", preco: "R$ 129,90/mês", link: "https://www.asaas.com/000/c/bjiv8fc18w63r89y" },
  recruiter: { nome: "Recruiter", preco: "R$ 99,90/mês", link: "https://www.asaas.com/000/c/5p8qk8zbmdkndtwy" },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
};
const json = (dados: unknown, status = 200) => Response.json(dados, { status, headers: CORS });
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Cupom = { codigo: string; tipo: string; produtos: string[]; ativo: boolean; valido_ate: string | null; limite_total: number | null };

/** Valida o cupom para o plano. Devolve { ok, cupom } ou { ok: false, motivo }. */
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

const DESCRICAO: Record<string, string> = { gratuito: "Acesso gratuito, sem cobrança e sem prazo." };

// Proteção contra uso em série do mesmo cupom (ex.: vários e-mails inventados).
const USOS_POR_IP_24H = Number(Deno.env.get("CUPOM_USOS_POR_IP_24H") ?? 3);

/** Resumo do IP (o IP em si não é guardado). */
async function hashIp(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "desconhecido";
  const dados = new TextEncoder().encode(`candydate:${ip}`);
  const hash = await crypto.subtle.digest("SHA-256", dados);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const plano = url.searchParams.get("plano") ?? "";
      const codigo = url.searchParams.get("cupom") ?? "";
      if (!PLANOS[plano]) return json({ ok: false, motivo: "Plano inválido." }, 400);
      if (!codigo) return json({ ok: true, plano: { id: plano, ...PLANOS[plano] } });
      const v = await validar(codigo, plano);
      const validade = v.ok && v.cupom.valido_ate ? ` Use até ${v.cupom.valido_ate.split("-").reverse().join("/")}.` : "";
      return json(v.ok ? { ok: true, cupom: v.cupom.codigo, tipo: v.cupom.tipo, descricao: `${DESCRICAO[v.cupom.tipo]}${validade}` } : v, v.ok ? 200 : 404);
    }
    if (req.method !== "POST") return json({ ok: false, motivo: "Método não permitido." }, 405);

    const corpo = await req.json().catch(() => ({}));
    const plano = String(corpo.plano ?? "");
    const email = String(corpo.email ?? "").trim().toLowerCase();
    const nome = String(corpo.nome ?? "").trim().slice(0, 160) || null;
    const codigo = String(corpo.cupom ?? "").trim().toUpperCase();
    if (!PLANOS[plano] || !PRODUTOS_VALIDOS.has(plano)) return json({ ok: false, motivo: "Escolha um plano." }, 400);
    if (!EMAIL.test(email) || email.length > 254) return json({ ok: false, motivo: "Informe um e-mail válido." }, 400);

    // Sem cupom: pagamento pelo link do Asaas (o webhook libera ao confirmar).
    if (!codigo) return json({ ok: true, acao: "pagar", link: PLANOS[plano].link });

    const v = await validar(codigo, plano);
    if (!v.ok) return json(v, 422);
    if (await temProduto(email, plano)) return json({ ok: false, motivo: `Este e-mail já tem acesso ao ${PLANOS[plano].nome}. É só entrar na extensão.` }, 409);

    const ip = await hashIp(req);
    const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: recentes } = await admin.from("cupom_usos").select("id", { count: "exact", head: true }).eq("cupom", v.cupom.codigo).eq("ip_hash", ip).gte("criado_em", desde);
    if ((recentes ?? 0) >= USOS_POR_IP_24H) return json({ ok: false, motivo: "Limite de usos deste cupom atingido nesta conexão. Tente novamente amanhã ou fale com a Candydate." }, 429);

    // Uma vez por pessoa em cada produto (a restrição única do banco garante).
    const { error: uso } = await admin.from("cupom_usos").insert({ cupom: v.cupom.codigo, email, nome, produto: plano, ip_hash: ip });
    if (uso) {
      if (uso.code === "23505") return json({ ok: false, motivo: "Este e-mail já usou este cupom neste plano." }, 409);
      throw uso;
    }
    try {
      const r = await liberar(email, nome, plano, { origem: "cupom", cupom: v.cupom.codigo });
      return json({ ok: true, acao: "liberado", novaConta: r.novaConta, plano: PLANOS[plano].nome });
    } catch (e) {
      // Falhou ao liberar: devolve o uso para a pessoa tentar de novo.
      await admin.from("cupom_usos").delete().eq("cupom", v.cupom.codigo).eq("email", email).eq("produto", plano);
      throw e;
    }
  } catch (e) {
    console.error(e);
    return json({ ok: false, motivo: "Não foi possível concluir agora. Tente novamente em instantes." }, 500);
  }
});
