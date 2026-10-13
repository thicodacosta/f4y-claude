// Liberação e retirada de acesso aos produtos Candydate, únicas para todos os
// canais (webhook do Asaas e checkout com cupom): a conta é tratada sempre do
// mesmo jeito, venha de onde vier.
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string, padrao = "") => Deno.env.get(k) ?? padrao;

export const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const publico = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { auth: { persistSession: false } });

export const PRODUTOS_VALIDOS = new Set(["bp", "recruiter"]);

/** Está no teste gratuito ativo deste produto? */
export async function emTeste(email: string, produto: string): Promise<boolean> {
  const { count } = await admin.from("testes").select("id", { count: "exact", head: true }).eq("email", email).eq("produto", produto).eq("status", "ativo");
  return (count ?? 0) > 0;
}

/** A conta já tem o produto? */
export async function temProduto(email: string, produto: string): Promise<boolean> {
  const { data: id } = await admin.rpc("conta_por_email", { p_email: email });
  if (!id) return false;
  const { data } = await admin.auth.admin.getUserById(id as string);
  const produtos = data?.user?.app_metadata?.produtos;
  return Array.isArray(produtos) && produtos.includes(produto);
}

/**
 * Libera o produto: conta nova é criada (sem senha própria) e recebe o e-mail
 * de senha provisória; conta existente só ganha o produto. Registra a
 * situação em `assinaturas`.
 */
export async function liberar(email: string, nome: string | null, produto: string, dados: Record<string, unknown> = {}) {
  const { data: id } = await admin.rpc("conta_por_email", { p_email: email });
  let userId = id as string | null;
  let novaConta = false;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nome, senhaPropria: false },
      app_metadata: { produtos: [produto] },
    });
    if (error) throw error;
    userId = data.user.id;
    novaConta = true;
  } else {
    const { error } = await admin.rpc("conceder_produto", { p_email: email, p_produto: produto });
    if (error) throw error;
  }
  const { error } = await admin
    .from("assinaturas")
    .upsert({ email, nome, user_id: userId, produto, status: "ativa", atrasada_desde: null, ...dados }, { onConflict: "email,produto" });
  if (error) throw error;
  // Assinou (ou usou cupom) depois do teste: o teste deixa de contar.
  await admin.from("testes").update({ status: "convertido" }).eq("email", email).eq("produto", produto).in("status", ["ativo", "encerrado"]);
  if (novaConta) await enviarSenhaProvisoria(email);
  return { novaConta, resultado: novaConta ? "conta criada e acesso liberado" : "acesso liberado" };
}

async function enviarSenhaProvisoria(email: string) {
  const { error } = await publico.auth.resetPasswordForEmail(email);
  if (error) console.warn("senha provisória não enviada", email, error.message);
}

/** Conta (cria se não existir) com o produto liberado. */
async function contaComProduto(email: string, nome: string | null, produto: string) {
  const { data: id } = await admin.rpc("conta_por_email", { p_email: email });
  if (id) {
    const { error } = await admin.rpc("conceder_produto", { p_email: email, p_produto: produto });
    if (error) throw error;
    return { userId: id as string, novaConta: false };
  }
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { nome, senhaPropria: false }, app_metadata: { produtos: [produto] } });
  if (error) throw error;
  return { userId: data.user.id, novaConta: true };
}

// ─── Cadastro do cliente ───────────────────────────────────────────────────

/** CPF válido (dígitos verificadores). Devolve só os 11 dígitos, ou null. */
export function cpfValido(valor: string): string | null {
  const d = String(valor ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]) ? d : null;
}

/** Telefone com DDD (10 ou 11 dígitos; aceita +55). */
export function telefoneValido(valor: string): string | null {
  let d = String(valor ?? "").replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? d : null;
}

export async function salvarCliente(c: { email: string; nome: string; cpf: string; telefone: string; asaas_cliente?: string | null }) {
  const { error } = await admin.from("clientes").upsert(c, { onConflict: "email" });
  if (error) throw error;
}

// ─── Teste gratuito ────────────────────────────────────────────────────────

export const TESTE = { dias: 3, tokens: 100_000 };

/**
 * Inicia o teste gratuito: uma vez por e-mail e uma vez por CPF em cada
 * produto (as restrições únicas do banco garantem). Devolve { ok, motivo? }.
 */
export async function iniciarTeste(email: string, nome: string, cpf: string, produto: string) {
  const { data: anterior } = await admin.from("testes").select("id").eq("produto", produto).or(`email.eq."${email}",cpf.eq."${cpf}"`).limit(1);
  if (anterior?.length) return { ok: false, motivo: "O teste gratuito já foi utilizado com este e-mail ou CPF. Assine para continuar usando." };
  const { userId, novaConta } = await contaComProduto(email, nome, produto);
  const { error } = await admin.from("testes").insert({ email, cpf, produto, user_id: userId, limite_tokens: TESTE.tokens, fim: new Date(Date.now() + TESTE.dias * 86_400_000).toISOString() });
  if (error) {
    // Corrida rara (dois pedidos ao mesmo tempo): desfaz a liberação.
    await admin.rpc("revogar_produto", { p_email: email, p_produto: produto });
    if (error.code === "23505") return { ok: false, motivo: "O teste gratuito já foi utilizado com este e-mail ou CPF. Assine para continuar usando." };
    throw error;
  }
  if (novaConta) await enviarSenhaProvisoria(email);
  return { ok: true, novaConta };
}

// ─── Situação do plano ─────────────────────────────────────────────────────

export type Situacao = {
  plano: "pago" | "cupom" | "teste" | "liberado" | "nenhum";
  bloqueado: boolean;
  motivo: string | null; // teste_encerrado | assinatura_inativa | sem_plano
  teste?: { tokens: number; limite: number; inicio: string; fim: string; pct: number; pctTokens: number; pctTempo: number; motivoFim: string | null };
  status?: string;
};

const pct = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

/** Situação da conta no produto (encerra o teste vencido na hora). */
export async function situacao(userId: string, email: string, produto: string, produtos: string[]): Promise<Situacao> {
  const { data: a } = await admin.from("assinaturas").select("status, origem").eq("email", email).eq("produto", produto).maybeSingle();
  if (a && ["ativa", "atrasada"].includes(a.status)) return { plano: a.origem === "cupom" ? "cupom" : "pago", bloqueado: false, motivo: null, status: a.status };

  const { data: t } = await admin.from("testes").select("*").eq("produto", produto).or(`user_id.eq.${userId},email.eq."${email}"`).order("inicio", { ascending: false }).limit(1).maybeSingle();
  if (t && t.status !== "convertido") {
    let atual = t;
    if (t.status === "ativo" && (new Date(t.fim) <= new Date() || t.tokens_usados >= t.limite_tokens)) {
      const motivo = t.tokens_usados >= t.limite_tokens ? "tokens" : "prazo";
      await admin.rpc("encerrar_teste", { p_id: t.id, p_motivo: motivo });
      atual = { ...t, status: "encerrado", motivo_fim: motivo };
    }
    const dur = new Date(atual.fim).getTime() - new Date(atual.inicio).getTime();
    const pctTokens = pct((atual.tokens_usados / atual.limite_tokens) * 100);
    const pctTempo = pct(((Date.now() - new Date(atual.inicio).getTime()) / dur) * 100);
    const teste = { tokens: atual.tokens_usados, limite: atual.limite_tokens, inicio: atual.inicio, fim: atual.fim, pctTokens, pctTempo, pct: Math.max(pctTokens, pctTempo), motivoFim: atual.motivo_fim };
    if (atual.status === "encerrado") return { plano: "teste", bloqueado: true, motivo: "teste_encerrado", teste: { ...teste, pct: 100 } };
    return { plano: "teste", bloqueado: false, motivo: null, teste };
  }
  if (a) return { plano: "nenhum", bloqueado: !produtos.includes(produto), motivo: "assinatura_inativa", status: a.status };
  // Liberado manualmente pelo administrador (sem assinatura nem teste).
  if (produtos.includes(produto)) return { plano: "liberado", bloqueado: false, motivo: null };
  return { plano: "nenhum", bloqueado: true, motivo: "sem_plano" };
}

/** Retira o produto (os dados da conta ficam guardados). */
export async function retirar(email: string, produto: string, status: string) {
  await admin.rpc("revogar_produto", { p_email: email, p_produto: produto });
  const { error } = await admin.from("assinaturas").upsert({ email, produto, status }, { onConflict: "email,produto" });
  if (error) throw error;
  return `acesso retirado (${status})`;
}
