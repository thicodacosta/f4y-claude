// Dados puros (sem "server-only"): usados pela aplicação e pelo seed.

/**
 * Biblioteca de perguntas do JourneyLab sobre fatores psicossociais relacionados
 * ao trabalho. Criada para o produto — NÃO é questionário oficial nem validado
 * pelo MTE. Trata de condições e organização do trabalho, sem caráter clínico.
 *
 * Escala de frequência (1 = Nunca … 5 = Sempre). A pontuação representa
 * EXPOSIÇÃO ao fator: quanto maior, mais exposição.
 *   direta  → frequência alta = mais exposição (pontua o próprio valor)
 *   reversa → item redigido de forma positiva: pontua 6 − valor
 * "rapida" marca os itens da versão rápida (2 por fator).
 * "severidade" é a referência do produto para a matriz indicativa (1 moderada,
 * 2 alta, 3 muito alta) — a organização revisa conforme sua metodologia do GRO/PGR.
 */
export const METODOLOGIA_VERSAO = "jl-nr1-2026.1";

export const ESCALA_NR1 = [
  { valor: 1, rotulo: "Nunca" },
  { valor: 2, rotulo: "Raramente" },
  { valor: 3, rotulo: "Ocasionalmente" },
  { valor: 4, rotulo: "Frequentemente" },
  { valor: 5, rotulo: "Sempre" },
] as const;
export const SEM_RESPOSTA = "Prefiro não responder ou não se aplica";

export type ItemNr1 = { chave: string; texto: string; reversa: boolean; rapida: boolean };
export type FatorNr1 = { chave: string; nome: string; descricao: string; severidade: 1 | 2 | 3; itens: ItemNr1[] };

const d = (chave: string, texto: string, rapida = false): ItemNr1 => ({ chave, texto, reversa: false, rapida });
const r = (chave: string, texto: string, rapida = false): ItemNr1 => ({ chave, texto, reversa: true, rapida });

export const FATORES_NR1: FatorNr1[] = [
  {
    chave: "assedio",
    nome: "Assédio de qualquer natureza",
    descricao: "Exposição a condutas ofensivas, humilhantes, intimidadoras ou de natureza sexual no trabalho.",
    severidade: 3,
    itens: [
      d("ass1", "Presencio ou recebo comentários ofensivos, humilhantes ou constrangedores no trabalho.", true),
      d("ass2", "Sou exposto(a) a cobranças feitas de forma desrespeitosa ou intimidadora."),
      d("ass3", "Presencio ou recebo insinuações, contatos ou convites de natureza sexual indesejados no trabalho."),
      r("ass4", "Sinto segurança para relatar situações de desrespeito sem medo de retaliação.", true),
    ],
  },
  {
    chave: "suporte",
    nome: "Suporte e apoio no ambiente de trabalho",
    descricao: "Apoio da liderança e dos colegas, acesso a informações e recursos.",
    severidade: 2,
    itens: [
      r("sup1", "Recebo apoio da minha liderança quando preciso.", true),
      r("sup2", "Posso contar com colegas quando o trabalho aperta."),
      r("sup3", "Tenho acesso às informações e aos recursos necessários para fazer meu trabalho."),
      d("sup4", "Fico sem orientação diante de problemas que não consigo resolver sozinho(a).", true),
    ],
  },
  {
    chave: "mudancas",
    nome: "Gestão de mudanças organizacionais",
    descricao: "Comunicação, participação e preparo diante de mudanças.",
    severidade: 1,
    itens: [
      r("mud1", "Mudanças que afetam meu trabalho são comunicadas com antecedência.", true),
      r("mud2", "Sou consultado(a) sobre mudanças que impactam minha rotina."),
      d("mud3", "Mudanças frequentes de prioridade atrapalham a execução do meu trabalho.", true),
      r("mud4", "Recebo o preparo ou o treinamento necessário quando há mudanças no trabalho."),
    ],
  },
  {
    chave: "clareza_papel",
    nome: "Clareza de papel ou função",
    descricao: "Entendimento das responsabilidades, expectativas e critérios de avaliação.",
    severidade: 1,
    itens: [
      r("cla1", "Sei com clareza quais são minhas responsabilidades.", true),
      d("cla2", "Recebo demandas conflitantes de pessoas diferentes.", true),
      r("cla3", "Sei como meu desempenho é avaliado."),
      d("cla4", "Fico em dúvida sobre o que se espera de mim nas tarefas."),
    ],
  },
  {
    chave: "recompensas",
    nome: "Recompensas e reconhecimento",
    descricao: "Reconhecimento do esforço, valorização e oportunidades de desenvolvimento.",
    severidade: 1,
    itens: [
      r("rec1", "Meu esforço e meus resultados são reconhecidos.", true),
      r("rec2", "Percebo coerência entre minhas responsabilidades e a forma como sou valorizado(a)."),
      r("rec3", "Tenho oportunidades de crescimento e desenvolvimento no trabalho."),
      d("rec4", "Minhas contribuições passam despercebidas.", true),
    ],
  },
  {
    chave: "controle_autonomia",
    nome: "Controle sobre o trabalho e autonomia",
    descricao: "Liberdade para organizar o trabalho, fazer pausas e participar de decisões.",
    severidade: 1,
    itens: [
      r("aut1", "Tenho liberdade para decidir como organizar meu trabalho.", true),
      r("aut2", "Posso fazer pausas quando preciso."),
      r("aut3", "Participo das decisões que afetam o meu trabalho."),
      d("aut4", "Meu trabalho é controlado em detalhes, sem espaço para iniciativa.", true),
    ],
  },
  {
    chave: "justica",
    nome: "Justiça organizacional",
    descricao: "Critérios, imparcialidade e coerência nas decisões sobre pessoas.",
    severidade: 2,
    itens: [
      r("jus1", "As decisões sobre pessoas seguem critérios claros e aplicados a todos.", true),
      d("jus2", "Percebo favorecimento na distribuição de tarefas, oportunidades ou benefícios.", true),
      r("jus3", "Sou tratado(a) com imparcialidade em avaliações e conflitos."),
      d("jus4", "As regras mudam conforme quem está envolvido."),
    ],
  },
  {
    chave: "eventos_traumaticos",
    nome: "Eventos violentos ou traumáticos",
    descricao: "Exposição a agressões, ameaças ou situações graves e o acolhimento posterior.",
    severidade: 3,
    itens: [
      d("vio1", "No trabalho, sou exposto(a) a agressões verbais ou físicas de clientes, usuários ou terceiros.", true),
      d("vio2", "Presencio ou vivencio situações de ameaça, violência ou acidentes graves no trabalho.", true),
      r("vio3", "Após situações difíceis no trabalho, recebo acolhimento e suporte da organização."),
    ],
  },
  {
    chave: "subcarga",
    nome: "Subcarga de trabalho",
    descricao: "Falta de demanda, tarefas monótonas ou subaproveitamento das competências.",
    severidade: 1,
    itens: [
      d("sub1", "Tenho menos trabalho do que poderia realizar na minha jornada."),
      d("sub2", "Minhas tarefas são repetitivas e pouco aproveitam minhas habilidades.", true),
      d("sub3", "Fico períodos sem atividades definidas por falta de demanda ou de planejamento.", true),
      r("sub4", "Meu trabalho aproveita adequadamente meus conhecimentos e competências."),
    ],
  },
  {
    chave: "sobrecarga",
    nome: "Sobrecarga de trabalho",
    descricao: "Volume, ritmo, prazos e extensão da jornada.",
    severidade: 2,
    itens: [
      d("sob1", "Preciso trabalhar em ritmo acelerado para dar conta das demandas.", true),
      d("sob2", "Estendo a jornada ou trabalho em horários de descanso para cumprir prazos.", true),
      r("sob3", "Os prazos que recebo são compatíveis com o volume de trabalho."),
      d("sob4", "Acumulo tarefas de outras funções ou de vagas não preenchidas."),
    ],
  },
  {
    chave: "relacionamentos",
    nome: "Relacionamentos no trabalho",
    descricao: "Cooperação, respeito e tratamento de conflitos entre as pessoas.",
    severidade: 2,
    itens: [
      r("rel1", "Há cooperação entre as pessoas da minha equipe.", true),
      d("rel2", "Conflitos no trabalho ficam sem tratamento e se prolongam.", true),
      r("rel3", "Sou tratado(a) com respeito pelos colegas e pela liderança."),
      d("rel4", "Presencio situações de exclusão ou isolamento de pessoas na equipe."),
    ],
  },
  {
    chave: "comunicacao_dificil",
    nome: "Condições de difícil comunicação",
    descricao: "Acesso a informações, canais de escuta e ruídos que afetam o trabalho.",
    severidade: 1,
    itens: [
      d("com1", "Tenho dificuldade de obter respostas das áreas de que dependo.", true),
      r("com2", "As informações importantes chegam a mim a tempo."),
      r("com3", "Tenho canais adequados para expressar opiniões e sugestões.", true),
      d("com4", "Ruídos de comunicação geram retrabalho ou erros no meu trabalho."),
    ],
  },
  {
    chave: "remoto_isolado",
    nome: "Trabalho remoto ou isolado",
    descricao: "Isolamento, meios de apoio a distância e limites entre trabalho e vida pessoal.",
    severidade: 1,
    itens: [
      d("rem1", "Trabalho isolado(a), sem contato frequente com colegas ou liderança.", true),
      r("rem2", "Tenho meios adequados para pedir ajuda quando trabalho a distância ou sozinho(a)."),
      d("rem3", "Tenho dificuldade de separar o tempo de trabalho do tempo pessoal.", true),
    ],
  },
];

export type TipoDiagnostico = "completo" | "rapido" | "personalizado";
export const TIPO_DIAGNOSTICO: Record<TipoDiagnostico, { nome: string; descricao: string }> = {
  completo: { nome: "Completo", descricao: "As 50 perguntas dos 13 fatores." },
  rapido: { nome: "Rápido", descricao: "26 perguntas: duas por fator." },
  personalizado: { nome: "Personalizado", descricao: "Você escolhe as perguntas da biblioteca." },
};

/** Itens do questionário conforme o tipo (personalizado: chaves escolhidas). Mantém a ordem da biblioteca. */
export function itensDoTipo(tipo: TipoDiagnostico, escolhidas: string[] = []) {
  return FATORES_NR1.map((f) => ({ ...f, itens: f.itens.filter((i) => (tipo === "completo" ? true : tipo === "rapido" ? i.rapida : escolhidas.includes(i.chave))) })).filter((f) => f.itens.length);
}
