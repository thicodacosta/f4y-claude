/**
 * Catálogo de módulos, ações e escopos + papéis padrão (matriz de
 * docs/journeylab/arquitetura.md §4). Seguro para Client Components.
 * As permissões efetivas ficam em `papel_permissoes` e são editáveis pelo
 * administrador de cada organização.
 */

export type Modulo = "crm" | "onboarding" | "feedback" | "pulse" | "pdi" | "nr1";
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
];

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
      // Feedback: vê metadados/compromissos de todos; anotações seguem regra própria.
      ["feedback", ["visualizar", "exportar", "administrar"], "todos"],
      ["pulse", TUDO, "todos"],
      ["pdi", TUDO, "todos"],
      ["nr1", TUDO, "todos"],
    ],
  },
  {
    nome: "RH/Recrutador",
    base: "rh",
    regras: [
      ["cadastro", ["visualizar", "criar", "editar"], "todos"],
      ["crm", ["visualizar", "criar", "editar", "concluir", "exportar"], "todos"],
      ["onboarding", ["visualizar", "criar", "editar", "concluir", "exportar"], "todos"],
      ["feedback", ["visualizar"], "todos"],
      ["pulse", ["visualizar", "criar", "editar", "concluir"], "todos"],
      ["pdi", ["visualizar", "editar"], "todos"],
      // NR-1: sem acesso por padrão — o administrador concede se necessário.
    ],
  },
  {
    nome: "Líder/Gestor",
    base: "gestor",
    regras: [
      ["cadastro", ["visualizar"], "equipe"],
      ["onboarding", ["visualizar", "concluir"], "equipe"],
      ["feedback", ["visualizar", "criar", "editar", "concluir"], "equipe"],
      ["pulse", ["visualizar"], "equipe"],
      ["pdi", ["visualizar", "criar", "editar", "concluir"], "equipe"],
    ],
  },
  {
    nome: "Colaborador",
    base: "colaborador",
    regras: [
      ["cadastro", ["visualizar"], "proprio"],
      ["onboarding", ["visualizar", "concluir"], "proprio"],
      ["feedback", ["visualizar", "concluir"], "proprio"],
      ["pdi", ["visualizar", "editar"], "proprio"],
      // Pulse e NR-1: responder é permitido a quem está no público da pesquisa/ciclo.
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
