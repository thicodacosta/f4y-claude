/**
 * Pipeline de Vagas — definições puras (servidor e cliente).
 * "concluida" = vaga encerrada (status fechada); as demais etapas são de vagas
 * abertas ou pausadas. A etapa é do processo seletivo; a etapa de cada candidato
 * continua na candidatura (Kanban do CRM).
 */
export const ETAPAS_PIPELINE = {
  planejamento: { nome: "Planejamento", ajuda: "Requisição aprovada, perfil e divulgação em preparo." },
  divulgacao: { nome: "Divulgação", ajuda: "Vaga publicada, atraindo candidaturas." },
  triagem: { nome: "Triagem", ajuda: "Análise de currículos e primeiras conversas." },
  entrevistas: { nome: "Entrevistas", ajuda: "Entrevistas com RH, gestor e testes." },
  proposta: { nome: "Proposta", ajuda: "Candidato aprovado, proposta em negociação." },
  concluida: { nome: "Concluída", ajuda: "Vaga preenchida ou encerrada." },
} as const;
export type EtapaPipeline = keyof typeof ETAPAS_PIPELINE;
export const ORDEM_PIPELINE = Object.keys(ETAPAS_PIPELINE) as EtapaPipeline[];

export const PRIORIDADES = {
  urgente: { nome: "Urgente", tom: "perigo", ordem: 0 },
  alta: { nome: "Alta", tom: "alerta", ordem: 1 },
  media: { nome: "Média", tom: "info", ordem: 2 },
  baixa: { nome: "Baixa", tom: "neutro", ordem: 3 },
} as const;
export type Prioridade = keyof typeof PRIORIDADES;
