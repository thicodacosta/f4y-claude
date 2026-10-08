/**
 * Importação em massa de colaboradores (Configurações e aba Pessoas).
 * Modelo: Nome, Cargo, Gestor, E-mail, Telefone. Colunas extras reconhecidas
 * quando existirem: Área, Admissão, Salário, Vínculo.
 *
 * Regra de gravação: e-mail já cadastrado → atualiza a pessoa (só os campos
 * preenchidos na planilha); sem e-mail ou e-mail novo → cria. Linhas com
 * erro não são gravadas e aparecem na prévia.
 */
import { carregar, store } from "./db.js";
import { gerarXlsx } from "./planilha.js";
import { normalize, saveBlob, supabase } from "./toolskit.js";

export const COLUNAS_MODELO = ["Nome", "Cargo", "Gestor", "E-mail", "Telefone"];

const SINONIMOS = {
  nome: ["nome", "nome completo", "colaborador", "funcionario"],
  cargo: ["cargo", "funcao", "posicao"],
  gestor: ["gestor", "gestora", "gestor(a)", "lider", "gestor direto"],
  email: ["e-mail", "email", "e mail", "email corporativo"],
  telefone: ["telefone", "celular", "whatsapp", "fone", "telefone (com ddd)"],
  area: ["area", "departamento", "setor"],
  admissao: ["admissao", "data de admissao"],
  salario: ["salario", "remuneracao", "salario mensal"],
  vinculo: ["vinculo", "contrato", "tipo de contrato"],
};

const limpa = (s) => normalize(String(s ?? "")).replace(/\*/g, "").replace(/\s+/g, " ").trim();
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Telefone só com dígitos (e + do DDI); aceita de 10 a 13 dígitos. */
export function normalizarTelefone(valor) {
  const t = String(valor ?? "").trim();
  if (!t) return { valor: null };
  const digitos = t.replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 13) return { erro: `Telefone "${t}" precisa ter DDD (10 a 13 dígitos).` };
  return { valor: `${t.startsWith("+") ? "+" : ""}${digitos}` };
}

/** (11) 98765-4321 para exibir; número estrangeiro (+DDI ≠ 55) fica como digitado em dígitos. */
export function formatarTelefone(t) {
  if (!t) return "";
  const d = t.replace(/\D/g, "");
  let local = d;
  let ddi = "";
  if (t.startsWith("+")) {
    if (!d.startsWith("55")) return `+${d}`;
    ddi = "+55 ";
    local = d.slice(2);
  }
  if (local.length === 11) return `${ddi}(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `${ddi}(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return t;
}

/** Link do WhatsApp (Brasil por padrão quando não há DDI). */
export const linkWhatsapp = (t) => {
  const d = (t ?? "").replace(/\D/g, "");
  return d ? `https://wa.me/${t.startsWith("+") ? d : `55${d}`}` : null;
};

function data(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // Data do Excel (número de dias desde 30/12/1899).
  if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000).toISOString().slice(0, 10);
  return null;
}

/**
 * Converte a matriz da planilha em um plano: { novos, atualizados, iguais, erros, faltaNome }.
 * Cada item guarda a linha original (para a prévia).
 */
export function planejar(linhas) {
  if (!linhas.length) return { erroGeral: "A planilha está vazia." };
  const cab = linhas[0].map(limpa);
  const idx = Object.fromEntries(Object.entries(SINONIMOS).map(([campo, nomes]) => [campo, cab.findIndex((c) => nomes.includes(c))]));
  if (idx.nome < 0) return { erroGeral: "Não encontrei a coluna \"Nome\" na primeira linha. Use o modelo para download." };

  const porEmail = new Map(store.colaboradores.filter((c) => c.email).map((c) => [c.email.toLowerCase(), c]));
  const vistos = new Set();
  const plano = { novos: [], atualizados: [], iguais: [], erros: [] };

  linhas.slice(1).forEach((linha, k) => {
    const n = k + 2; // número da linha na planilha
    const get = (campo) => (idx[campo] >= 0 ? String(linha[idx[campo]] ?? "").trim() : "");
    const nome = get("nome");
    const email = get("email").toLowerCase();
    if (!nome && !email && !get("cargo")) return; // linha vazia
    if (!nome) return plano.erros.push({ n, motivo: "Nome em branco." });
    if (nome.length > 160) return plano.erros.push({ n, nome, motivo: "Nome com mais de 160 caracteres." });
    if (email && !EMAIL.test(email)) return plano.erros.push({ n, nome, motivo: `E-mail "${email}" inválido.` });
    if (email && vistos.has(email)) return plano.erros.push({ n, nome, motivo: `E-mail "${email}" repetido na planilha.` });
    if (email) vistos.add(email);
    const tel = normalizarTelefone(get("telefone"));
    if (tel.erro) return plano.erros.push({ n, nome, motivo: tel.erro });

    const vinculo = limpa(get("vinculo"));
    const salario = get("salario") ? Number(get("salario").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) : null;
    const campos = {
      nome,
      email: email || null,
      cargo: get("cargo") || null,
      gestor: get("gestor") || null,
      telefone: tel.valor,
      ...(idx.area >= 0 && get("area") ? { area: get("area") } : {}),
      ...(idx.admissao >= 0 && data(get("admissao")) ? { admissao: data(get("admissao")) } : {}),
      ...(idx.salario >= 0 && Number.isFinite(salario) && salario > 0 ? { salario } : {}),
      ...(idx.vinculo >= 0 && vinculo ? { vinculo: ["clt", "pj"].includes(vinculo) ? vinculo : vinculo.startsWith("estag") ? "estagio" : "outro" } : {}),
    };
    const existente = email && porEmail.get(email);
    if (!existente) return plano.novos.push({ n, campos });
    // Atualiza só o que veio preenchido e mudou.
    const mudancas = Object.fromEntries(Object.entries(campos).filter(([k2, v]) => v != null && v !== "" && String(existente[k2] ?? "") !== String(v)));
    if (Object.keys(mudancas).length) plano.atualizados.push({ n, id: existente.id, campos: mudancas, nome });
    else plano.iguais.push({ n, nome });
  });
  return plano;
}

/** Grava o plano. Devolve { criados, atualizados }. */
export async function aplicar(plano, aoProgresso) {
  let criados = 0;
  let atualizados = 0;
  // Em lotes de 200 (inserção) e 10 em paralelo (atualização).
  for (let i = 0; i < plano.novos.length; i += 200) {
    const lote = plano.novos.slice(i, i + 200).map((x) => ({ ...x.campos, empresa_id: store.empresaId }));
    const { error } = await supabase.from("bp_colaboradores").insert(lote);
    if (error) throw error;
    criados += lote.length;
    aoProgresso?.(criados + atualizados);
  }
  for (let i = 0; i < plano.atualizados.length; i += 10) {
    const lote = plano.atualizados.slice(i, i + 10);
    const resultados = await Promise.all(lote.map((x) => supabase.from("bp_colaboradores").update(x.campos).eq("id", x.id)));
    const falha = resultados.find((r) => r.error);
    if (falha) throw falha.error;
    atualizados += lote.length;
    aoProgresso?.(criados + atualizados);
  }
  await carregar();
  return { criados, atualizados };
}

/** Modelo para download (.xlsx) com a aba de preenchimento e a de instruções. */
export function baixarModelo() {
  const blob = gerarXlsx([
    { nome: "Colaboradores", cabecalho: true, linhas: [COLUNAS_MODELO], larguras: [34, 28, 28, 34, 20], texto: [4] },
    {
      nome: "Instruções",
      titulo: true,
      larguras: [110],
      linhas: [
        ["Como preencher"],
        ["1. Preencha a aba \"Colaboradores\": uma pessoa por linha, a partir da linha 2. Não altere a primeira linha."],
        ["2. Nome é obrigatório. Cargo, Gestor, E-mail e Telefone são recomendados."],
        ["3. E-mail: se já existir no BP, a pessoa é atualizada (não duplica). Ele também liga as respostas do Pulso ao histórico da pessoa."],
        ["4. Telefone com DDD, ex.: (11) 98765-4321. Para outro país, comece com + e o código do país."],
        ["5. Gestor: escreva o nome como ele deve aparecer nos relatórios, sempre do mesmo jeito."],
        ["6. Salve como .xlsx (ou .csv) e importe em Configurações > Colaboradores > Importar planilha."],
        [""],
        ["Exemplo (não copie para a aba Colaboradores):"],
        ["Ana Souza | Analista Financeira | Marina Lopes | ana.souza@empresa.com.br | (11) 98765-4321"],
      ],
    },
  ]);
  saveBlob(blob, "Modelo - Colaboradores Candydate BP.xlsx");
}

/** Exporta a base atual no mesmo formato do modelo (para editar e reimportar). */
export function exportarBase() {
  const linhas = [COLUNAS_MODELO, ...store.colaboradores.filter((c) => c.status === "ativo").map((c) => [c.nome, c.cargo ?? "", c.gestor ?? "", c.email ?? "", formatarTelefone(c.telefone)])];
  saveBlob(gerarXlsx([{ nome: "Colaboradores", cabecalho: true, linhas, larguras: [34, 28, 28, 34, 20], texto: [4] }]), `Colaboradores ${new Date().toLocaleDateString("sv-SE")}.xlsx`);
}
