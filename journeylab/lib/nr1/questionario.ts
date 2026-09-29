// Dados puros (sem "server-only"): usados pela aplicação e pelo seed.

/**
 * Questionário de REFERÊNCIA (editável no rascunho). Não é um instrumento
 * validado; a organização pode adaptá-lo ou substituí-lo pelo instrumento
 * escolhido pela sua equipe de SST. "i" = pergunta invertida.
 */
export const QUESTIONARIO_REFERENCIA: { nome: string; descricao: string; perguntas: [string, boolean][] }[] = [
  {
    nome: "Demandas e ritmo de trabalho",
    descricao: "Volume, prazos e intensidade do trabalho.",
    perguntas: [
      ["Consigo realizar meu trabalho dentro da jornada prevista.", false],
      ["Preciso trabalhar em ritmo acelerado por longos períodos.", true],
      ["As metas do meu trabalho são alcançáveis.", false],
    ],
  },
  {
    nome: "Autonomia e controle",
    descricao: "Liberdade para organizar o próprio trabalho e participar de decisões.",
    perguntas: [
      ["Tenho liberdade para decidir como realizar meu trabalho.", false],
      ["Posso opinar sobre mudanças que afetam meu trabalho.", false],
      ["Sou impedido(a) de fazer pausas quando preciso.", true],
    ],
  },
  {
    nome: "Apoio da liderança",
    descricao: "Disponibilidade, orientação e abertura da liderança.",
    perguntas: [
      ["Minha liderança está disponível quando preciso de ajuda.", false],
      ["Recebo orientações claras da minha liderança.", false],
      ["Sinto-me à vontade para comunicar problemas à liderança.", false],
    ],
  },
  {
    nome: "Relações e convivência",
    descricao: "Cooperação e respeito entre as pessoas.",
    perguntas: [
      ["Há cooperação entre as pessoas da minha equipe.", false],
      ["Presencio situações de desrespeito ou hostilidade no trabalho.", true],
      ["Sou tratado(a) com respeito pelos colegas.", false],
    ],
  },
  {
    nome: "Clareza de papel",
    descricao: "Entendimento das responsabilidades e de a quem recorrer.",
    perguntas: [
      ["Sei exatamente quais são minhas responsabilidades.", false],
      ["Recebo demandas conflitantes de pessoas diferentes.", true],
      ["Sei a quem recorrer quando tenho dúvidas.", false],
    ],
  },
  {
    nome: "Reconhecimento e justiça",
    descricao: "Reconhecimento do esforço e equidade nas decisões.",
    perguntas: [
      ["Meu esforço é reconhecido.", false],
      ["As decisões sobre pessoas são tomadas de forma justa.", false],
      ["Percebo favorecimento na distribuição de oportunidades.", true],
    ],
  },
  {
    nome: "Mudanças e comunicação",
    descricao: "Comunicação sobre mudanças e previsibilidade.",
    perguntas: [
      ["Sou informado(a) com antecedência sobre mudanças que me afetam.", false],
      ["As mudanças na organização são bem explicadas.", false],
      ["Sinto insegurança por falta de informação sobre o futuro do meu trabalho.", true],
    ],
  },
];
