import { toStructuredSchema } from "../schema.js";

const nullableString = (description) => ({ type: ["string", "null"], ...(description && { description }) });

/** Estrutura padronizada de um currículo, preenchida pelo Claude. */
const CV_SCHEMA = {
  type: "object",
  properties: {
    nome: { type: "string", description: "Nome completo do candidato, como aparece no currículo." },
    tituloProfissional: nullableString(
      "Cargo ou título profissional atual ou pretendido, como indicado no currículo (ex.: 'Engenheira de Dados Sênior'). null se não houver.",
    ),
    localizacao: nullableString("Somente cidade e estado/país. Nunca endereço completo."),
    contato: {
      type: "object",
      properties: {
        email: nullableString(),
        telefone: nullableString(),
        linkedin: nullableString("URL ou identificador do LinkedIn."),
      },
      required: ["email", "telefone", "linkedin"],
    },
    resumo: {
      type: "string",
      description:
        "Resumo profissional de 3 a 5 linhas, em terceira pessoa, montado só com fatos do currículo: área, tempo de experiência (se explícito), principais empresas, especialidades.",
    },
    experiencias: {
      type: "array",
      description: "Experiências profissionais, da mais recente para a mais antiga.",
      items: {
        type: "object",
        properties: {
          empresa: { type: "string" },
          cargo: { type: "string" },
          periodo: nullableString("Como aparece no currículo, padronizado como 'mm/aaaa – mm/aaaa' ou 'mm/aaaa – atual' quando possível."),
          local: nullableString("Cidade/país, se informado."),
          atividades: {
            type: "array",
            description: "Responsabilidades e resultados, em frases curtas e objetivas, preservando números e fatos.",
            items: { type: "string" },
          },
        },
        required: ["empresa", "cargo", "periodo", "local", "atividades"],
      },
    },
    formacao: {
      type: "array",
      items: {
        type: "object",
        properties: {
          curso: { type: "string" },
          instituicao: { type: "string" },
          nivel: nullableString("Ex.: 'Graduação', 'MBA', 'Mestrado', 'Técnico'."),
          periodo: nullableString("Ano de conclusão ou período, como informado."),
        },
        required: ["curso", "instituicao", "nivel", "periodo"],
      },
    },
    idiomas: {
      type: "array",
      items: {
        type: "object",
        properties: { idioma: { type: "string" }, nivel: nullableString("Como informado, ex.: 'Fluente', 'Avançado'.") },
        required: ["idioma", "nivel"],
      },
    },
    competencias: {
      type: "array",
      description: "Competências técnicas, ferramentas e metodologias citadas no currículo. Sem duplicatas.",
      items: { type: "string" },
    },
    certificacoes: {
      type: "array",
      description: "Certificações e cursos complementares.",
      items: {
        type: "object",
        properties: { nome: { type: "string" }, instituicao: nullableString(), ano: nullableString() },
        required: ["nome", "instituicao", "ano"],
      },
    },
    informacoesAdicionais: {
      type: "array",
      description: "Outras informações profissionais relevantes (ex.: disponibilidade para viagens, prêmios, publicações). Nunca dados pessoais sensíveis.",
      items: { type: "string" },
    },
  },
  required: [
    "nome",
    "tituloProfissional",
    "localizacao",
    "contato",
    "resumo",
    "experiencias",
    "formacao",
    "idiomas",
    "competencias",
    "certificacoes",
    "informacoesAdicionais",
  ],
};

export const CV_OUTPUT_FORMAT = { type: "json_schema", schema: toStructuredSchema(CV_SCHEMA) };
