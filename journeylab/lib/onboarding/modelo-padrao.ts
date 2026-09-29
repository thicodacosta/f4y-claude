// Dados puros (sem "server-only"): usados pelo serviço e pelo seed.
type ResponsavelTarefa = "rh" | "gestor" | "colaborador";
type TipoTarefa = "tarefa" | "documento" | "material";

type TarefaPadrao = { titulo: string; responsavel: ResponsavelTarefa; tipo?: TipoTarefa };

/** Template inicial editável — genérico (sem regras de clientes específicos). */
export const MODELO_PADRAO: { nome: string; descricao: string; fases: { titulo: string; descricao: string; marcoDias: number; tarefas: TarefaPadrao[] }[] } = {
  nome: "Onboarding 30/60/90",
  descricao: "Modelo inicial em três fases. Edite fases, prazos e tarefas conforme a organização.",
  fases: [
    {
      titulo: "Boas-vindas e Cultura",
      descricao: "Até o dia 30",
      marcoDias: 30,
      tarefas: [
        { titulo: "Apresentação da empresa e cultura", responsavel: "rh" },
        { titulo: "Configuração de e-mail e acessos", responsavel: "rh" },
        { titulo: "Reunião com o gestor direto", responsavel: "gestor" },
        { titulo: "Conhecer o time", responsavel: "gestor" },
        { titulo: "Leitura das políticas da empresa", responsavel: "colaborador", tipo: "documento" },
      ],
    },
    {
      titulo: "Processos e Expectativas",
      descricao: "Até o dia 60",
      marcoDias: 60,
      tarefas: [
        { titulo: "Entender os processos da área", responsavel: "gestor" },
        { titulo: "Participar de reuniões do time", responsavel: "colaborador" },
        { titulo: "Primeira entrega supervisionada", responsavel: "colaborador" },
        { titulo: "Feedback intermediário", responsavel: "gestor" },
      ],
    },
    {
      titulo: "Consolidação",
      descricao: "Até o dia 90",
      marcoDias: 90,
      tarefas: [
        { titulo: "Definição de metas do trimestre", responsavel: "gestor" },
        { titulo: "Projeto ou tarefa independente", responsavel: "colaborador" },
        { titulo: "Avaliação final do onboarding", responsavel: "rh" },
      ],
    },
  ],
};

