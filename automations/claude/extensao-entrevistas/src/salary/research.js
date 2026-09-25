import { requestToolResult } from "../claude.js";
import { toStructuredSchema } from "../schema.js";

// Bases consultadas. A busca e a leitura de páginas ficam restritas a estes
// domínios (subdomínios incluídos).
export const SOURCES = ["LinkedIn", "Glassdoor", "Robert Half", "Hays"];
const ALLOWED_DOMAINS = [
  "linkedin.com",
  "glassdoor.com",
  "glassdoor.com.br",
  "roberthalf.com",
  "roberthalf.com.br",
  "hays.com",
  "hays.com.br",
];

const money = (description) => ({ type: ["number", "null"], description });

const RESULT_TOOL = {
  name: "registrar_pesquisa_salarial",
  description:
    "Registra o resultado final da pesquisa salarial. Chame uma única vez, depois de concluir as buscas, só com dados encontrados nas fontes.",
  input_schema: toStructuredSchema({
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
  }),
};

const SYSTEM_PROMPT = `Você é analista de remuneração de uma consultoria de Recruitment & Executive Search no Brasil. Faça pesquisas salariais objetivas e rastreáveis.

COMO PESQUISAR (seja rápido)
- Faça as buscas de uma vez, em paralelo: uma busca por fonte na primeira rodada. Só faça nova busca se uma fonte não trouxer nada útil.
- Leia uma página inteira (web_fetch) apenas quando o resultado da busca não trouxer o valor; no máximo 2 leituras.
- Consulte as quatro bases: LinkedIn (LinkedIn Salary e vagas com faixa divulgada), Glassdoor, Robert Half (Guia Salarial) e Hays (Guia Salarial). Priorize a edição mais recente de cada guia.
- Faça buscas específicas por cargo, senioridade e localidade; se não houver dado exato, use o cargo equivalente mais próximo e diga isso na descrição da referência.
- Converta tudo para valor mensal em reais. Se a fonte trouxer valor anual, divida por 13,33 (12 salários + 13º + 1/3 de férias) para CLT e informe isso na descrição.

REGRAS
- Nunca invente números. Cada referência precisa vir de uma página consultada. Fonte sem dado vai para fontesSemDado.
- O consolidado deve refletir as referências (ex.: mediana entre os valores médios). Se houver uma só referência, diga isso nas observações.
- Para PJ, prefira dado de fonte; se derivar do CLT, use um fator entre 1,3 e 1,6 e explique na observação.
- Ao terminar, chame registrar_pesquisa_salarial uma única vez. Não escreva o resultado em texto.`;

function buildRequest({ cargo, senioridade, localidade, regime, setor, observacoes }) {
  return [
    "Pesquise a remuneração para:",
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

export function researchSalary({ apiKey, input, signal, effort = "low", onProgress }) {
  return requestToolResult({
    apiKey,
    system: SYSTEM_PROMPT,
    content: buildRequest(input),
    tools: [
      // Limites baixos mantêm a pesquisa rápida (cada rodada de busca/leitura
      // soma segundos) e o custo previsível.
      { type: "web_search_20260209", name: "web_search", max_uses: 6, allowed_domains: ALLOWED_DOMAINS },
      { type: "web_fetch_20260209", name: "web_fetch", max_uses: 2, allowed_domains: ALLOWED_DOMAINS },
    ],
    resultTool: RESULT_TOOL,
    // Coleta e consolidação de dados, não raciocínio profundo: esforço
    // baixo reduz bastante o tempo total.
    effort,
    onProgress,
    signal,
  });
}
