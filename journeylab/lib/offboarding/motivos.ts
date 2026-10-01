/**
 * Taxonomia única de motivos de saída — usada no registro do desligamento
 * (motivo declarado), na entrevista (motivos reais), nas ações de retenção
 * (fator tratado) e nos indicadores. Pura: servidor e cliente.
 */

export const MOTIVOS = {
  remuneracao: {
    nome: "Remuneração e benefícios",
    resumo: "Salário, variável ou benefícios abaixo do esperado ou do mercado.",
    acoes: [
      "Revisar a faixa salarial do cargo com pesquisa de mercado atualizada",
      "Comunicar com clareza a política de remuneração e os critérios de mérito",
      "Avaliar benefícios flexíveis de alto valor percebido e baixo custo",
    ],
  },
  crescimento: {
    nome: "Crescimento e carreira",
    resumo: "Falta de perspectiva de promoção, desafios ou desenvolvimento.",
    acoes: [
      "Criar ou atualizar o PDI com objetivos de carreira e prazos",
      "Publicar trilhas de carreira e critérios de promoção",
      "Abrir vagas internas antes do recrutamento externo",
    ],
  },
  lideranca: {
    nome: "Liderança direta",
    resumo: "Relação com o gestor, estilo de gestão, falta de apoio ou de feedback.",
    acoes: [
      "Garantir cadência de 1:1 e feedback estruturado com o gestor",
      "Incluir o gestor em programa de desenvolvimento de liderança",
      "Acompanhar indicadores de saída e clima por gestor",
    ],
  },
  cultura: {
    nome: "Cultura e ambiente",
    resumo: "Clima, relacionamento com colegas, valores ou segurança psicológica.",
    acoes: [
      "Rodar Pulse de clima e tratar os pontos de atenção com a equipe",
      "Fortalecer rituais de integração e reconhecimento entre pares",
      "Mapear fatores psicossociais (Diagnóstico NR-1) e executar o plano de ação",
    ],
  },
  carga: {
    nome: "Carga de trabalho e equilíbrio",
    resumo: "Excesso de demanda, jornada, pressão ou desgaste.",
    acoes: [
      "Revisar a distribuição de demandas e o dimensionamento da equipe",
      "Combinar prioridades e limites de jornada nos 1:1",
      "Monitorar sinais de esgotamento em Pulse e NR-1",
    ],
  },
  reconhecimento: {
    nome: "Reconhecimento",
    resumo: "Sensação de que as contribuições não são vistas ou valorizadas.",
    acoes: [
      "Instituir reconhecimento público e frequente das entregas",
      "Registrar conquistas no feedback 1:1 e no PDI",
      "Ligar reconhecimento a critérios claros de mérito",
    ],
  },
  proposta: {
    nome: "Proposta de outra empresa",
    resumo: "Saída motivada por oferta externa (salário, cargo ou projeto).",
    acoes: [
      "Mapear talentos críticos e fazer conversas de permanência (stay interviews)",
      "Antecipar movimentos de mérito e promoção para posições-chave",
      "Acompanhar o mercado para cargos com alta procura",
    ],
  },
  flexibilidade: {
    nome: "Modelo de trabalho e flexibilidade",
    resumo: "Presencial, híbrido ou remoto, horários e deslocamento.",
    acoes: [
      "Rever a política de trabalho híbrido/remoto por função",
      "Oferecer flexibilidade de horário onde a operação permitir",
    ],
  },
  pessoal: {
    nome: "Motivos pessoais",
    resumo: "Mudança de cidade, família, saúde, estudos ou pausa na carreira.",
    acoes: ["Avaliar alternativas como licença, remoto ou redução de jornada", "Manter a porta aberta para recontratação"],
  },
  desempenho: {
    nome: "Desempenho ou comportamento",
    resumo: "Saída por iniciativa da empresa por desempenho ou conduta.",
    acoes: [
      "Revisar o processo seletivo do cargo (perfil e critérios)",
      "Reforçar onboarding, metas claras e feedback nos primeiros 90 dias",
    ],
  },
  reestruturacao: {
    nome: "Reestruturação ou redução",
    resumo: "Mudança organizacional, corte de custos ou fim de projeto.",
    acoes: ["Planejar a comunicação e o apoio na transição (recolocação)", "Priorizar realocação interna antes do desligamento"],
  },
  outro: { nome: "Outro motivo", resumo: "Motivo não listado.", acoes: ["Registrar o contexto para análise caso a caso"] },
} as const;

export type Motivo = keyof typeof MOTIVOS;
export const CHAVES_MOTIVO = Object.keys(MOTIVOS) as Motivo[];
export const nomeMotivo = (m: string | null | undefined) => (m && m in MOTIVOS ? MOTIVOS[m as Motivo].nome : (m ?? "—"));

export const TIPO_DESLIGAMENTO = {
  pedido_demissao: { nome: "Pedido de demissão", voluntario: true },
  dispensa_sem_justa_causa: { nome: "Dispensa sem justa causa", voluntario: false },
  dispensa_justa_causa: { nome: "Dispensa por justa causa", voluntario: false },
  acordo: { nome: "Acordo entre as partes", voluntario: true },
  termino_contrato: { nome: "Término de contrato", voluntario: false },
  aposentadoria: { nome: "Aposentadoria", voluntario: true },
  outro: { nome: "Outro", voluntario: false },
} as const;

export type TipoDesligamento = keyof typeof TIPO_DESLIGAMENTO;

export const STATUS_ENTREVISTA = {
  pendente: { nome: "Entrevista pendente", tom: "alerta" },
  enviada: { nome: "Aguardando resposta", tom: "info" },
  respondida: { nome: "Entrevista respondida", tom: "sucesso" },
  dispensada: { nome: "Sem entrevista", tom: "neutro" },
} as const;

export type StatusEntrevista = keyof typeof STATUS_ENTREVISTA;
