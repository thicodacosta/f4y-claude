import { GROQ_FAST_MODEL, groqStructured, groqWebResearch } from "../groq.js";
import { toStructuredSchema } from "../schema.js";

// Bases consultadas. A busca da Groq não restringe domínios pela API: a
// restrição vem do prompt (buscas com site:) e da etapa de organização, que
// descarta dado de outras fontes.
export const SOURCES = ["LinkedIn", "Glassdoor", "Robert Half", "Hays"];

const money = (description) => ({ type: ["number", "null"], description });

const RESULT_SCHEMA = toStructuredSchema({
    type: "object",
    properties: {
      cargoPesquisado: { type: "string", description: "Cargo como foi pesquisado, com a senioridade." },
      localidade: { type: "string" },
      referencias: {
        type: "array",
        description: "Um item por dado salarial encontrado. Nunca inclua dado que não veio de uma fonte consultada.",
        items: {
          type: "object",
          properties: {
            fonte: { type: "string", enum: SOURCES },
            descricao: {
              type: "string",
              description: "O que o dado representa, ex.: 'Guia Salarial 2026, Gerente Financeiro, empresa de grande porte'.",
            },
            minimo: money("Valor mínimo mensal em reais."),
            medio: money("Valor médio ou mediano mensal em reais."),
            maximo: money("Valor máximo mensal em reais."),
            regime: { type: ["string", "null"], description: "'CLT' ou 'PJ', se a fonte especifica; senão null." },
            referenciaData: { type: ["string", "null"], description: "Ano ou data de referência do dado." },
            url: { type: ["string", "null"], description: "Página onde o dado foi encontrado." },
          },
          required: ["fonte", "descricao", "minimo", "medio", "maximo", "regime", "referenciaData", "url"],
        },
      },
      consolidado: {
        type: "object",
        description: "Faixa mensal em reais para CLT consolidada a partir das referências. null nos campos sem base suficiente.",
        properties: { minimo: money(), mediana: money(), maximo: money() },
        required: ["minimo", "mediana", "maximo"],
      },
      estimativaPJ: {
        type: "object",
        description:
          "Faixa mensal PJ em reais. Use dado de fonte quando houver; senão, derive do consolidado CLT e explique o fator na observação.",
        properties: { minimo: money(), maximo: money(), observacao: { type: ["string", "null"] } },
        required: ["minimo", "maximo", "observacao"],
      },
      beneficiosComuns: { type: "array", items: { type: "string" }, description: "Benefícios citados pelas fontes para o cargo." },
      fatoresDeVariacao: {
        type: "array",
        items: { type: "string" },
        description: "O que mais altera a remuneração, segundo as fontes (porte, setor, região, certificações).",
      },
      fontesSemDado: {
        type: "array",
        items: { type: "string", enum: SOURCES },
        description: "Fontes consultadas em que não foi encontrado dado para este cargo.",
      },
      observacoes: { type: "string", description: "Leitura consultiva curta (2-4 frases) sobre o mercado para o cargo." },
    },
    required: [
      "cargoPesquisado",
      "localidade",
      "referencias",
      "consolidado",
      "estimativaPJ",
      "beneficiosComuns",
      "fatoresDeVariacao",
      "fontesSemDado",
      "observacoes",
    ],
});

const RESEARCH_PROMPT = `Você é analista de remuneração de uma consultoria de Recruitment & Executive Search no Brasil. Pesquise salários na web de forma rápida e rastreável.

FONTES PERMITIDAS: somente LinkedIn, Glassdoor, Robert Half (Guia Salarial) e Hays (Guia Salarial). Ignore qualquer outro site.

BUSCAS: faça uma busca separada para cada uma das 4 fontes, com o operador site:
1. site:glassdoor.com.br <cargo> salário <cidade>
2. site:roberthalf.com <cargo> guia salarial
3. site:hays.com.br <cargo> guia salarial
4. site:linkedin.com <cargo> salário <cidade>
Se a busca de uma fonte não trouxer valor, tente uma vez com um cargo equivalente (ex.: "Gerente de Tesouraria/Financeiro").

COMO RESPONDER
Para cada fonte, escreva um bloco:
FONTE: <nome>
URL: <endereço exato da página>
DADO: <valores encontrados, exatamente como aparecem, com período (mensal/anual), regime (CLT/PJ), porte/setor e ano de referência>
Se não encontrar dado de uma fonte, escreva "FONTE: <nome> — sem dado público encontrado".
No fim, liste benefícios e fatores de variação citados pelas fontes.

REGRAS: nunca invente números; copie os valores como aparecem; prefira as edições mais recentes dos guias.`;

const ORGANIZE_PROMPT = `Você organiza notas de pesquisa salarial em um formato estruturado.

REGRAS
- Use somente dados presentes nas notas. Nunca invente números nem URLs.
- Aceite apenas referências de LinkedIn, Glassdoor, Robert Half e Hays. Descarte qualquer outra fonte.
- Converta tudo para valor mensal em reais. Valor anual CLT: divida por 13,33 (12 salários + 13º + 1/3 de férias) e diga isso na descrição.
- O consolidado CLT deve refletir as referências (ex.: mediana entre os valores médios). Com uma só referência, diga isso nas observações.
- Para PJ, use dado de fonte quando houver; senão, derive do consolidado CLT com fator entre 1,3 e 1,6 e explique na observação.
- Fonte sem dado vai para fontesSemDado.
- Observações: 2 a 4 frases em tom consultivo, em português.`;

function describeRequest({ cargo, senioridade, localidade, regime, setor, observacoes }) {
  return [
    `- Cargo: ${cargo.trim()}`,
    `- Senioridade: ${senioridade || "não informada"}`,
    `- Localidade: ${localidade.trim() || "Brasil"}`,
    `- Regime de interesse: ${regime}`,
    setor.trim() && `- Setor/porte da empresa: ${setor.trim()}`,
    observacoes.trim() && `- Observações: ${observacoes.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Pesquisa salarial via Groq, em duas etapas: a busca na web (que não aceita
 * saída estruturada) e a organização das notas no formato do painel.
 */
export async function researchSalary({ apiKey, input, signal, onProgress }) {
  const request = describeRequest(input);

  onProgress?.("Buscando no LinkedIn, Glassdoor, Robert Half e Hays…");
  const research = await groqWebResearch({
    apiKey,
    system: RESEARCH_PROMPT,
    user: `Pesquise a remuneração para:\n${request}`,
    signal,
  });

  onProgress?.("Organizando os resultados…");
  const pages = research.pages.length
    ? `\n\nPáginas consultadas:\n${research.pages.map((p) => `- ${p.title} ${p.url}`).join("\n")}`
    : "";
  return groqStructured({
    apiKey,
    system: ORGANIZE_PROMPT,
    user: `Pesquisa solicitada:\n${request}\n\n<notas_da_pesquisa>\n${research.text}${pages}\n</notas_da_pesquisa>`,
    name: "pesquisa_salarial",
    schema: RESULT_SCHEMA,
    model: GROQ_FAST_MODEL,
    reasoningEffort: "low",
    signal,
  });
}
