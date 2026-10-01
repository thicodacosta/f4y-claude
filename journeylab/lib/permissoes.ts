/**
 * Catálogo de módulos, ações e escopos + papéis padrão (matriz de
 * docs/journeylab/arquitetura.md §4). Seguro para Client Components.
 * As permissões efetivas ficam em `papel_permissoes` e são editáveis pelo
 * administrador de cada organização.
 */

export type Modulo = "crm" | "onboarding" | "feedback" | "pulse" | "pdi" | "nr1" | "offboarding" | "retencao" | "analytics";
export type AreaPermissao = "organizacao" | "cadastro" | Modulo;
export type Acao = "visualizar" | "criar" | "editar" | "concluir" | "exportar" | "administrar";
export type Escopo = "proprio" | "equipe" | "todos";
export type PapelBase = "admin_org" | "rh" | "gestor" | "colaborador" | "personalizado";

export const MODULOS: { chave: Modulo; nome: string; resumo: string; icone: string }[] = [
  { chave: "crm", nome: "CRM de Candidatos", resumo: "Base de candidatos, vagas e relacionamento.", icone: "Users" },
  { chave: "onboarding", nome: "Onboarding", resumo: "Modelos, tarefas e acompanhamento da integração.", icone: "DoorOpen" },
  { chave: "feedback", nome: "Feedback 1:1", resumo: "Reuniões individuais, acordos e compromissos.", icone: "MessagesSquare" },
  { chave: "pulse", nome: "Pulse", resumo: "Pesquisas rápidas com resultados agregados.", icone: "Activity" },
  { chave: "pdi", nome: "PDI", resumo: "Planos individuais de desenvolvimento.", icone: "Target" },
  { chave: "nr1", nome: "Diagnóstico NR-1", resumo: "Ciclos sobre fatores psicossociais e planos de ação.", icone: "ShieldCheck" },
  { chave: "offboarding", nome: "Offboarding", resumo: "Registro de desligamentos e entrevista de saída para entender os motivos reais.", icone: "DoorClosed" },
  { chave: "retencao", nome: "Retenção", resumo: "Turnover, motivos de saída, risco de saída e ações de retenção.", icone: "HeartHandshake" },
  { chave: "analytics", nome: "People Analytics", resumo: "Indicadores integrados, insights, projeções e comparativo de mercado.", icone: "ChartNoAxesCombined" },
];

/** Rota de cada módulo (padrão: /{chave}). */
export const ROTA_MODULO: Record<Modulo, string> = {
  crm: "/crm",
  onboarding: "/onboarding",
  feedback: "/feedback",
  pulse: "/pulse",
  pdi: "/pdi",
  nr1: "/nr1",
  offboarding: "/offboarding",
  retencao: "/retencao",
  analytics: "/people-analytics",
};

export const NOME_MODULO = Object.fromEntries(MODULOS.map((m) => [m.chave, m.nome])) as Record<Modulo, string>;

export const AREAS: { chave: AreaPermissao; nome: string }[] = [
  { chave: "organizacao", nome: "Organização (usuários, papéis, módulos)" },
  { chave: "cadastro", nome: "Cadastro de pessoas e equipes" },
  ...MODULOS.map((m) => ({ chave: m.chave as AreaPermissao, nome: m.nome })),
];

export const ACOES: { chave: Acao; nome: string }[] = [
  { chave: "visualizar", nome: "Visualizar" },
  { chave: "criar", nome: "Criar" },
  { chave: "editar", nome: "Editar" },
  { chave: "concluir", nome: "Concluir" },
  { chave: "exportar", nome: "Exportar" },
  { chave: "administrar", nome: "Administrar" },
];

export const ESCOPOS: { chave: Escopo; nome: string }[] = [
  { chave: "proprio", nome: "Próprio" },
  { chave: "equipe", nome: "Equipe" },
  { chave: "todos", nome: "Todos" },
];

export const ORDEM_ESCOPO: Record<Escopo, number> = { proprio: 1, equipe: 2, todos: 3 };

type Regra = [AreaPermissao, Acao[], Escopo];
const TUDO: Acao[] = ["visualizar", "criar", "editar", "concluir", "exportar", "administrar"];

/** Papéis criados em toda nova organização. */
export const PAPEIS_PADRAO: { nome: string; base: PapelBase; regras: Regra[] }[] = [
  {
    nome: "Administrador da organização",
    base: "admin_org",
    regras: [
      ["organizacao", TUDO, "todos"],
      ["cadastro", TUDO, "todos"],
      ["crm", TUDO, "todos"],
      ["onboarding", TUDO, "todos"],
      // Feedback: registra e administra os feedbacks da empresa; anotações de 1:1 seguem regra própria.
      ["feedback", TUDO, "todos"],
      ["pulse", TUDO, "todos"],
      ["pdi", TUDO, "todos"],
      ["nr1", TUDO, "todos"],
      ["offboarding", TUDO, "todos"],
      ["retencao", TUDO, "todos"],
      ["analytics", TUDO, "todos"],
    ],
  },
  {
    nome: "RH/Recrutador",
    base: "rh",
    regras: [
      ["cadastro", ["visualizar", "criar", "editar"], "todos"],
      ["crm", ["visualizar", "criar", "editar", "concluir", "exportar"], "todos"],
      ["onboarding", ["visualizar", "criar", "editar", "concluir", "exportar"], "todos"],
      ["feedback", ["visualizar", "criar", "editar", "concluir", "exportar"], "todos"],
      ["pulse", ["visualizar", "criar", "editar", "concluir", "exportar"], "todos"],
      ["pdi", ["visualizar", "criar", "editar", "exportar"], "todos"],
      ["nr1", ["visualizar", "criar", "editar", "concluir", "exportar"], "todos"],
      // Offboarding: entrevistas de desligamento são confidenciais (RH/Admin; nunca o gestor).
      ["offboarding", ["visualizar", "criar", "editar", "concluir", "exportar"], "todos"],
      ["retencao", ["visualizar", "criar", "editar", "concluir", "exportar"], "todos"],
      ["analytics", ["visualizar", "exportar"], "todos"],
    ],
  },
  {
    nome: "Líder/Gestor",
    base: "gestor",
    regras: [
      ["cadastro", ["visualizar"], "equipe"],
      ["onboarding", ["visualizar", "concluir"], "equipe"],
      ["feedback", ["visualizar", "criar", "editar", "concluir"], "equipe"],
      // Pulse: leitura dos resultados agregados da empresa (sem criar/editar).
      ["pulse", ["visualizar"], "todos"],
      ["pdi", ["visualizar", "criar", "editar", "concluir"], "equipe"],
      // Retenção: risco e ações da própria equipe.
      ["retencao", ["visualizar", "criar", "editar", "concluir"], "equipe"],
    ],
  },
  {
    nome: "Colaborador",
    base: "colaborador",
    regras: [
      ["cadastro", ["visualizar"], "proprio"],
      // Onboarding: colaborador não acessa nesta versão (tarefas dele são acompanhadas por RH e gestor).
      // Feedback 1:1 e PDI: colaborador não acessa nesta versão.
      // Pulse: sem acesso ao módulo — responde pelo link pessoal (e-mail) ou pelo Início.
      // NR-1: sem acesso ao módulo interno — responde só pela página pública do convite.
    ],
  },
];

export type MapaPermissoes = Partial<Record<`${AreaPermissao}:${Acao}`, Escopo>>;

export function escopoDe(mapa: MapaPermissoes, area: AreaPermissao, acao: Acao): Escopo | null {
  return mapa[`${area}:${acao}`] ?? null;
}

export const STATUS_ENTITLEMENT: Record<string, { nome: string; libera: boolean }> = {
  ativo: { nome: "Ativo", libera: true },
  teste: { nome: "Em teste", libera: true },
  inativo: { nome: "Inativo", libera: false },
  suspenso: { nome: "Suspenso", libera: false },
  expirado: { nome: "Expirado", libera: false },
};
