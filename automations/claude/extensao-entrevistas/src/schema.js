/**
 * Definição canônica do registro de entrevista, exatamente como especificada
 * (formato de tool da Anthropic). A extensão não chama como tool: forçar uma
 * tool (`tool_choice`) é incompatível com o raciocínio adaptativo do modelo.
 * Por isso, o `input_schema` abaixo é convertido em saída estruturada
 * (`output_config.format`), que garante um JSON válido contra o schema.
 */
export const ANALYZE_INTERVIEW_TOOL = {
  name: "analyze_interview",
  description:
    "Estrutura o registro de uma entrevista de emprego transcrita, como apoio à documentação do recrutador — nunca uma avaliação, nota ou decisão.",
  input_schema: {
    type: "object",
    properties: {
      resumoExecutivo: {
        type: "string",
        description:
          "5-10 linhas: trajetória, experiência relevante, principais competências, momento profissional e pontos importantes mencionados. Só o que foi de fato dito.",
      },
      experienciaProfissional: {
        type: "array",
        description: "Experiências profissionais relevantes mencionadas na conversa, organizadas.",
        items: {
          type: "object",
          properties: {
            empresa: { type: "string" },
            cargo: { type: ["string", "null"] },
            periodo: { type: ["string", "null"], description: "Ex.: '2020–2023' ou '3 anos' — como foi mencionado." },
            descricao: { type: "string", description: "O que foi dito sobre essa experiência." },
          },
          required: ["empresa", "cargo", "periodo", "descricao"],
        },
      },
      experienciaRelacionadaVaga: {
        type: "array",
        description:
          "Experiências que atendem diretamente requisitos desta vaga específica — cite o requisito e a evidência.",
        items: {
          type: "object",
          properties: {
            requisito: { type: "string", description: "Requisito da vaga (dos dados fornecidos)." },
            evidencia: { type: "string", description: "O que na entrevista mostra aderência a esse requisito." },
          },
          required: ["requisito", "evidencia"],
        },
      },
      competenciasTecnicas: {
        type: "array",
        description:
          "Tecnologias, ferramentas, metodologias, plataformas, certificações ou conhecimentos MENCIONADOS. Nunca inferir uma tecnologia não citada.",
        items: { type: "string" },
      },
      competenciasComportamentais: {
        type: "array",
        description:
          "Aspectos observáveis na entrevista (comunicação, clareza, liderança, organização, autonomia, argumentação, relacionamento, visão de negócio). SEMPRE em linguagem de evidência: 'demonstrou boa capacidade de comunicação ao explicar projetos complexos', NUNCA 'é uma pessoa comunicativa'. Nunca afirme traço de personalidade como diagnóstico.",
        items: {
          type: "object",
          properties: {
            competencia: { type: "string", description: "Ex.: 'Comunicação', 'Liderança'." },
            evidencia: {
              type: "string",
              description: "Frase em linguagem de evidência, baseada no que foi dito/demonstrado.",
            },
          },
          required: ["competencia", "evidencia"],
        },
      },
      motivacaoProfissional: {
        type: ["string", "null"],
        description:
          "O que o candidato mencionou sobre mudança de emprego, objetivos, carreira, ambiente desejado, desafios procurados. null se não foi abordado.",
      },
      disponibilidade: {
        type: ["string", "null"],
        description:
          "Quando mencionado: prazo para início, modelo de trabalho, viagens, mudança, disponibilidade para entrevistas. null se não foi abordado.",
      },
      expectativaSalarial: {
        type: ["string", "null"],
        description:
          "Somente se o tema tiver sido abordado explicitamente na conversa. NUNCA inferir salário — null se não foi dito.",
      },
      pontosPositivos: {
        type: "array",
        description: "Principais aspectos favoráveis identificados na entrevista.",
        items: {
          type: "object",
          properties: {
            descricao: { type: "string" },
            trechoTranscricao: {
              type: ["string", "null"],
              description: "Trecho literal da transcrição, se houver um claro.",
            },
          },
          required: ["descricao", "trechoTranscricao"],
        },
      },
      pontosAtencao: {
        type: "array",
        description:
          "Aspectos que precisam ser investigados ou validados — baseados EXCLUSIVAMENTE no conteúdo da entrevista, nunca em julgamento subjetivo. Linguagem cautelosa e não-definitiva: nunca 'candidato não possui X', sempre 'X não foi validado/abordado nesta entrevista'.",
        items: {
          type: "object",
          properties: { descricao: { type: "string" } },
          required: ["descricao"],
        },
      },
      resumoFinal: {
        type: "string",
        description: "Fechamento curto (1-3 frases) da entrevista.",
      },
    },
    required: [
      "resumoExecutivo",
      "experienciaProfissional",
      "experienciaRelacionadaVaga",
      "competenciasTecnicas",
      "competenciasComportamentais",
      "motivacaoProfissional",
      "disponibilidade",
      "expectativaSalarial",
      "pontosPositivos",
      "pontosAtencao",
      "resumoFinal",
    ],
  },
};

/**
 * Adapta um JSON Schema de tool às regras da saída estruturada: todo objeto
 * fecha com `additionalProperties: false`, e `type: [X, "null"]` vira
 * `anyOf`, que é a forma aceita para campos anuláveis.
 */
function toStructuredSchema(node) {
  if (Array.isArray(node)) return node.map(toStructuredSchema);
  if (!node || typeof node !== "object") return node;

  const { type, description, ...rest } = node;
  if (Array.isArray(type)) {
    const variants = type.map((t) => toStructuredSchema({ ...rest, type: t }));
    return description ? { description, anyOf: variants } : { anyOf: variants };
  }

  const out = {};
  if (type !== undefined) out.type = type;
  if (description !== undefined) out.description = description;
  for (const [key, value] of Object.entries(rest)) {
    out[key] =
      key === "properties"
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toStructuredSchema(v)]))
        : toStructuredSchema(value);
  }
  if (type === "object") out.additionalProperties = false;
  return out;
}

export const INTERVIEW_OUTPUT_FORMAT = {
  type: "json_schema",
  schema: toStructuredSchema(ANALYZE_INTERVIEW_TOOL.input_schema),
};
