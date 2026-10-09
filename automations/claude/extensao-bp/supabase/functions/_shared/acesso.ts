// Liberação e retirada de acesso aos produtos Candydate, únicas para todos os
// canais (webhook do Asaas e checkout com cupom): a conta é tratada sempre do
// mesmo jeito, venha de onde vier.
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string, padrao = "") => Deno.env.get(k) ?? padrao;

export const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const publico = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { auth: { persistSession: false } });

export const PRODUTOS_VALIDOS = new Set(["bp", "recruiter"]);

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
  if (novaConta) {
    const { error: e } = await publico.auth.resetPasswordForEmail(email);
    if (e) console.warn("senha provisória não enviada", email, e.message);
  }
  return { novaConta, resultado: novaConta ? "conta criada e acesso liberado" : "acesso liberado" };
}

/** Retira o produto (os dados da conta ficam guardados). */
export async function retirar(email: string, produto: string, status: string) {
  await admin.rpc("revogar_produto", { p_email: email, p_produto: produto });
  const { error } = await admin.from("assinaturas").upsert({ email, produto, status }, { onConflict: "email,produto" });
  if (error) throw error;
  return `acesso retirado (${status})`;
}
