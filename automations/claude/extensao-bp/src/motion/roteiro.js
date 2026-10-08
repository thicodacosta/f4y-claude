/**
 * Roteiro do Motion: sequência de cenas que o motor (engine.js) anima. A IA
 * escreve o roteiro a partir do relatório da funcionalidade e do pedido do
 * usuário; sem IA disponível (ou se ela falhar), um roteiro-base é montado
 * direto dos dados, para o Motion nunca deixar de sair.
 *
 * Os números vêm sempre do relatório: o prompt proíbe inventar valores.
 */
import { FriendlyError, groqStructured, isClaudeUnavailable, requestStructured } from "../core/toolskit.js";
import { relatorioTexto } from "../core/texto.js";
import { toStructuredSchema } from "../../../extensao-entrevistas/src/schema.js";

export const TIPOS_CENA = ["abertura", "numeros", "barras", "evolucao", "topicos", "destaque", "citacao", "comparativo", "etapas", "encerramento"];

export { OPCOES } from "./opcoes.js";
import { OPCOES } from "./opcoes.js";

const item = {
  type: "object",
  additionalProperties: false,
  required: ["rotulo", "valor", "valorTexto", "destaque"],
  properties: {
    rotulo: { type: "string", description: "Rótulo curto (até 28 caracteres)." },
    valor: { type: ["number", "null"], description: "Valor numérico do relatório, quando houver (barras, evolução, comparativo)." },
    valorTexto: { type: ["string", "null"], description: "Valor formatado para exibir, ex.: \"12,5%\", \"R$ 48 mil\", \"4,2\"." },
    destaque: { type: "boolean", description: "Item em destaque; em evolucao, marca ponto de projeção." },
  },
};

export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titulo", "subtitulo", "cenas"],
  properties: {
    titulo: { type: "string" },
    subtitulo: { type: ["string", "null"] },
    cenas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "titulo", "subtitulo", "texto", "itens", "duracao"],
        properties: {
          tipo: { type: "string", enum: TIPOS_CENA },
          titulo: { type: "string", description: "Até 60 caracteres." },
          subtitulo: { type: ["string", "null"], description: "Até 90 caracteres." },
          texto: { type: ["string", "null"], description: "Frase de apoio, até 160 caracteres." },
          itens: { type: "array", items: item },
          duracao: { type: "number", description: "Segundos na tela (3 a 9)." },
        },
      },
    },
  },
};

const SISTEMA = `Você é diretor(a) de motion design de uma consultoria de RH de alto nível (tom consultivo, sofisticado, orientado a negócios). Cria roteiros de apresentações animadas sobre dados de pessoas (onboarding, produtividade, cultura, turnover, clima, desligamentos, gestão).

REGRAS
- Use SOMENTE números, nomes e fatos presentes no relatório. Nunca invente valores, metas ou comparações. Se faltar dado, use cenas de tópicos ou destaque com texto qualitativo.
- Atenda exatamente ao pedido do usuário (foco, público, tom e duração). A soma das durações deve ficar próxima da duração pedida.
- Comece com "abertura" e termine com "encerramento". Entre elas, varie os tipos para manter ritmo visual; não repita o mesmo tipo em sequência.
- Tipos de cena:
  abertura (título e subtítulo), numeros (2 a 4 indicadores em itens, com valorTexto), barras (3 a 7 itens com valor), evolucao (4 a 12 pontos no tempo com valor; destaque=true nos pontos de projeção), topicos (3 a 5 frases curtas em itens.rotulo), destaque (um número ou frase de impacto em itens[0]), citacao (texto = comentário real do relatório, sem identificar a pessoa), comparativo (2 itens: antes x depois, ou A x B), etapas (3 a 5 passos/recomendações), encerramento (mensagem final e próximo passo).
- Textos curtos, para leitura em movimento: títulos com até 60 caracteres, rótulos com até 28. Português do Brasil.
- Respeite LGPD: em apresentações para o time ou clientes, não exponha nomes de colaboradores com avaliações negativas, riscos ou desligamentos; agregue.
- Dados de risco e projeção são indicativos: deixe isso claro quando aparecerem.`;

function pedido(rel, briefing, op) {
  return `PEDIDO DO USUÁRIO
${briefing || "Apresentação executiva dos principais resultados."}

Público: ${OPCOES.publico[op.publico] ?? op.publico}
Duração alvo: ${op.duracao} segundos
Tom: ${OPCOES.tom[op.tom] ?? op.tom}
Formato: ${op.formato}

RELATÓRIO (fonte única dos dados)
${relatorioTexto(rel)}`;
}

/** Ajusta durações para somar a duração alvo e garante abertura/encerramento. */
export function normalizar(roteiro, op) {
  const cenas = (roteiro.cenas ?? []).filter((c) => TIPOS_CENA.includes(c.tipo)).slice(0, 16);
  if (cenas[0]?.tipo !== "abertura") cenas.unshift({ tipo: "abertura", titulo: roteiro.titulo, subtitulo: roteiro.subtitulo, texto: null, itens: [], duracao: 4 });
  if (cenas.at(-1)?.tipo !== "encerramento") cenas.push({ tipo: "encerramento", titulo: "Próximos passos", subtitulo: null, texto: null, itens: [], duracao: 4 });
  for (const c of cenas) {
    c.duracao = Math.min(9, Math.max(3, Number(c.duracao) || 5));
    c.itens = (c.itens ?? []).slice(0, c.tipo === "evolucao" ? 12 : 7);
  }
  const alvo = Number(op.duracao) || 45;
  const soma = cenas.reduce((s, c) => s + c.duracao, 0);
  const k = alvo / soma;
  for (const c of cenas) c.duracao = Math.min(10, Math.max(2.8, Math.round(c.duracao * k * 10) / 10));
  return { titulo: roteiro.titulo, subtitulo: roteiro.subtitulo ?? null, cenas, opcoes: op };
}

/** Roteiro montado direto do relatório (sem IA). */
export function roteiroBase(rel, briefing, op) {
  const cenas = [{ tipo: "abertura", titulo: rel.titulo, subtitulo: briefing?.slice(0, 90) || rel.subtitulo || null, texto: null, itens: [], duracao: 4 }];
  if (rel.kpis?.length) cenas.push({ tipo: "numeros", titulo: "Indicadores-chave", subtitulo: rel.subtitulo ?? null, texto: null, itens: rel.kpis.slice(0, 4).map((k) => ({ rotulo: k.rotulo, valor: null, valorTexto: k.valor, destaque: false })), duracao: 6 });
  for (const g of (rel.graficos ?? []).slice(0, 2)) {
    const itens = g.itens.filter((i) => i.valor != null);
    if (itens.length < 2) continue;
    const linha = g.tipo !== "barras";
    cenas.push({
      tipo: linha ? "evolucao" : "barras",
      titulo: g.titulo,
      subtitulo: itens.some((i) => i.projetado) ? "Linha pontilhada: projeção indicativa pela tendência" : null,
      texto: null,
      itens: itens.slice(linha ? -12 : 0, linha ? undefined : 7).map((i) => ({ rotulo: i.rotulo, valor: Number(i.valor), valorTexto: `${String(Number(i.valor).toFixed(g.casas ?? 1)).replace(".", ",")}${g.sufixo ?? ""}`, destaque: Boolean(i.projetado) })),
      duracao: 6,
    });
  }
  if (rel.destaques?.length) cenas.push({ tipo: "topicos", titulo: "O que os dados mostram", subtitulo: null, texto: null, itens: rel.destaques.slice(0, 5).map((d) => ({ rotulo: d.slice(0, 90), valor: null, valorTexto: null, destaque: false })), duracao: 7 });
  cenas.push({ tipo: "encerramento", titulo: "Gestão de pessoas orientada por dados", subtitulo: rel.titulo, texto: null, itens: [], duracao: 4 });
  return normalizar({ titulo: rel.titulo, subtitulo: rel.subtitulo, cenas }, op);
}

/**
 * Roteiro pela IA (Claude; sem crédito/chave, Groq). Devolve
 * { roteiro, origem: "claude" | "groq" | "base", aviso? }.
 */
export async function gerarRoteiro({ rel, briefing, opcoes, keys, signal }) {
  const user = pedido(rel, briefing, opcoes);
  if (keys.apiKey) {
    try {
      const r = await requestStructured({
        apiKey: keys.apiKey,
        system: SISTEMA,
        content: [{ type: "text", text: user }],
        format: { type: "json_schema", schema: toStructuredSchema(SCHEMA) },
        effort: "medium",
        signal,
      });
      return { roteiro: normalizar(r, opcoes), origem: "claude" };
    } catch (e) {
      if (signal?.aborted) throw e;
      if (!isClaudeUnavailable(e) && !keys.groqKey) return { roteiro: roteiroBase(rel, briefing, opcoes), origem: "base", aviso: e.message };
      console.warn("Motion: Claude indisponível, tentando a Groq.", e.message);
    }
  }
  if (keys.groqKey) {
    try {
      const r = await groqStructured({ apiKey: keys.groqKey, system: SISTEMA, user, name: "roteiro_motion", schema: SCHEMA, reasoningEffort: "medium", signal });
      return { roteiro: normalizar(r, opcoes), origem: "groq" };
    } catch (e) {
      if (signal?.aborted) throw e;
      return { roteiro: roteiroBase(rel, briefing, opcoes), origem: "base", aviso: e instanceof FriendlyError ? e.message : "A IA não respondeu." };
    }
  }
  return { roteiro: roteiroBase(rel, briefing, opcoes), origem: "base", aviso: "Sem chave de IA: roteiro montado direto dos dados." };
}
