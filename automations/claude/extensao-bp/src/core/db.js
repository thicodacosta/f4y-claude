/**
 * Dados do BP no Supabase (mesmo projeto das contas da ToolsKit). Tudo passa
 * pelas políticas RLS da migração (supabase/migrations): cada conta só vê a
 * própria empresa.
 *
 * O painel carrega a base da empresa uma vez (`carregar`) e recarrega depois
 * de cada gravação; os módulos se inscrevem em `aoMudar` para se redesenhar.
 * Respostas de pesquisas vêm sob demanda (podem ser muitas).
 */
import { FriendlyError, supabase } from "./toolskit.js";

export const store = {
  empresaId: null,
  empresaNome: "",
  colaboradores: [],
  onboardings: [],
  avaliacoes: [],
  desligamentos: [],
  pesquisas: [],
  respostas: null, // carregadas sob demanda: [{ pesquisa_id, area, respostas, criado_em, colaborador_id }]
  carregadoEm: null,
};

// Avisa as outras páginas da extensão (painel lateral, Configurações, Motion)
// que a base mudou: elas recarregam sozinhas. `origem` evita que a página que
// gravou recarregue de novo.
const ORIGEM = Math.random().toString(36).slice(2);
export function sinalizarMudanca() {
  chrome.storage.local.set({ bpAtualizado: { em: Date.now(), origem: ORIGEM } }).catch(() => {});
}
let recarga = null;
chrome.storage.onChanged.addListener((mudancas, area) => {
  const v = area === "local" && mudancas.bpAtualizado?.newValue;
  if (!v || v.origem === ORIGEM || !store.empresaId) return;
  clearTimeout(recarga);
  recarga = setTimeout(() => carregar().catch((e) => console.warn(e)), 250);
});

const ouvintes = new Set();
export const aoMudar = (fn) => (ouvintes.add(fn), () => ouvintes.delete(fn));
const avisar = () => ouvintes.forEach((fn) => fn(store));

function erro(e, contexto) {
  console.error(contexto, e);
  const msg = `${e?.message ?? ""} ${e?.code ?? ""}`;
  if (/failed to fetch|network/i.test(msg)) return new FriendlyError("Sem conexão com o servidor. Verifique sua internet.");
  if (/jwt|session|auth/i.test(msg)) return new FriendlyError("Sua sessão expirou. Saia e entre de novo.");
  if (/bp_colaboradores_email_idx|duplicate key.*email/i.test(msg)) return new FriendlyError("Já existe um colaborador com este e-mail.");
  if (/relation .*bp_.* does not exist|bp_garantir_empresa/i.test(msg)) {
    return new FriendlyError("O banco do BP ainda não foi instalado neste projeto Supabase. Veja o README (migração em supabase/migrations).");
  }
  return new FriendlyError(`Não foi possível ${contexto}. Tente novamente.`);
}

async function q(promessa, contexto) {
  const { data, error } = await promessa;
  if (error) throw erro(error, contexto);
  return data;
}

/** Garante a empresa da conta (criada no 1º acesso com o nome da identidade). */
export async function iniciarEmpresa(nomeSugerido) {
  if (!supabase) throw new FriendlyError("O login (Supabase) não está configurado neste pacote.");
  store.empresaId = await q(supabase.rpc("bp_garantir_empresa", { p_nome: nomeSugerido ?? "" }), "abrir a empresa");
  const empresa = await q(supabase.from("bp_empresas").select("nome").eq("id", store.empresaId).single(), "abrir a empresa");
  store.empresaNome = empresa.nome;
  return store.empresaId;
}

export async function renomearEmpresa(nome) {
  await q(supabase.from("bp_empresas").update({ nome }).eq("id", store.empresaId), "renomear a empresa");
  store.empresaNome = nome;
}

const LIMITE = 5000;

/** Carrega a base da empresa e avisa os módulos. */
export async function carregar() {
  const id = store.empresaId;
  const [colaboradores, onboardings, avaliacoes, desligamentos, pesquisas] = await Promise.all([
    q(supabase.from("bp_colaboradores").select("*").eq("empresa_id", id).order("nome").limit(LIMITE), "carregar os colaboradores"),
    q(supabase.from("bp_onboardings").select("*").eq("empresa_id", id).order("inicio", { ascending: false }).limit(LIMITE), "carregar os onboardings"),
    q(supabase.from("bp_avaliacoes").select("*").eq("empresa_id", id).order("data", { ascending: false }).order("criado_em", { ascending: false }).limit(LIMITE), "carregar as avaliações"),
    q(supabase.from("bp_desligamentos").select("*").eq("empresa_id", id).order("data", { ascending: false }).limit(LIMITE), "carregar os desligamentos"),
    q(
      supabase.from("bp_pesquisas").select("*, bp_respostas(count)").eq("empresa_id", id).order("criado_em", { ascending: false }).limit(LIMITE),
      "carregar as pesquisas",
    ),
  ]);
  Object.assign(store, {
    colaboradores,
    onboardings,
    avaliacoes,
    desligamentos,
    pesquisas: pesquisas.map(({ bp_respostas, ...p }) => ({ ...p, total_respostas: bp_respostas?.[0]?.count ?? 0 })),
    respostas: null,
    carregadoEm: new Date(),
  });
  avisar();
  return store;
}

/** Respostas de todas as pesquisas da empresa (cache até a próxima recarga). */
export async function respostas() {
  if (store.respostas) return store.respostas;
  store.respostas = await q(
    supabase.from("bp_respostas").select("id, pesquisa_id, colaborador_id, nome, email, area, respostas, criado_em").eq("empresa_id", store.empresaId).order("criado_em").limit(20000),
    "carregar as respostas",
  );
  return store.respostas;
}

const comEmpresa = (linha) => ({ ...linha, empresa_id: store.empresaId });

export async function inserir(tabela, linha, contexto = "salvar") {
  const data = await q(supabase.from(tabela).insert(comEmpresa(linha)).select().single(), contexto);
  sinalizarMudanca();
  await carregar();
  return data;
}

export async function inserirVarios(tabela, linhas, contexto = "salvar") {
  const data = await q(supabase.from(tabela).insert(linhas.map(comEmpresa)).select(), contexto);
  sinalizarMudanca();
  await carregar();
  return data;
}

export async function atualizar(tabela, id, campos, contexto = "salvar", { recarregar = true } = {}) {
  const data = await q(supabase.from(tabela).update(campos).eq("id", id).select().single(), contexto);
  sinalizarMudanca();
  if (recarregar) await carregar();
  return data;
}

export async function excluir(tabela, id, contexto = "excluir") {
  await q(supabase.from(tabela).delete().eq("id", id), contexto);
  sinalizarMudanca();
  await carregar();
}

/** Linha do tempo de um colaborador (ou da empresa, sem `colaboradorId`). */
export async function historico(colaboradorId, limite = 200) {
  let consulta = supabase.from("bp_historico").select("*").eq("empresa_id", store.empresaId).order("criado_em", { ascending: false }).limit(limite);
  consulta = colaboradorId ? consulta.eq("colaborador_id", colaboradorId) : consulta;
  return q(consulta, "carregar o histórico");
}

export async function anotar(colaboradorId, texto) {
  await q(
    supabase.from("bp_historico").insert({ empresa_id: store.empresaId, colaborador_id: colaboradorId, modulo: "anotacao", evento: "anotacao", resumo: texto }),
    "salvar a anotação",
  );
}

/** Documentos gerados (Motion, análises) — guardados para consulta posterior. */
export async function salvarDocumento({ tipo, modulo, titulo, conteudo, colaboradorId = null }) {
  return q(
    supabase.from("bp_documentos").insert({ empresa_id: store.empresaId, tipo, modulo, titulo, conteudo, colaborador_id: colaboradorId }).select().single(),
    "guardar o documento",
  );
}

export async function documentos({ tipo, modulo, colaboradorId, limite = 30 } = {}) {
  let c = supabase.from("bp_documentos").select("*").eq("empresa_id", store.empresaId).order("criado_em", { ascending: false }).limit(limite);
  if (tipo) c = c.eq("tipo", tipo);
  if (modulo) c = c.eq("modulo", modulo);
  if (colaboradorId) c = c.eq("colaborador_id", colaboradorId);
  return q(c, "carregar os documentos");
}

/** Apaga documentos gerados de um tipo e funcionalidade (ex.: análises da Gestão). */
export async function excluirDocumentos({ tipo, modulo }) {
  await q(supabase.from("bp_documentos").delete().eq("empresa_id", store.empresaId).eq("tipo", tipo).eq("modulo", modulo), "limpar os documentos");
  sinalizarMudanca();
}

export async function documento(id) {
  return q(supabase.from("bp_documentos").select("*").eq("id", id).single(), "abrir o documento");
}

// ─── Conversas do Chat ─────────────────────────────────────────────────────

export async function conversas() {
  return q(supabase.from("bp_conversas").select("id, titulo, atualizado_em").eq("empresa_id", store.empresaId).order("atualizado_em", { ascending: false }).limit(30), "carregar as conversas");
}

export async function conversa(id) {
  return q(supabase.from("bp_conversas").select("*").eq("id", id).single(), "abrir a conversa");
}

export async function salvarConversa(id, titulo, mensagens) {
  if (id) {
    await q(supabase.from("bp_conversas").update({ titulo, mensagens }).eq("id", id), "salvar a conversa");
    return id;
  }
  const nova = await q(supabase.from("bp_conversas").insert({ empresa_id: store.empresaId, titulo, mensagens }).select("id").single(), "salvar a conversa");
  return nova.id;
}

// ─── Atalhos ───────────────────────────────────────────────────────────────

export const colaborador = (id) => store.colaboradores.find((c) => c.id === id);
export const nomeDe = (id) => colaborador(id)?.nome ?? "—";
export const ativos = () => store.colaboradores.filter((c) => c.status === "ativo");
