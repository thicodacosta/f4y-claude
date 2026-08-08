import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  GitPullRequest,
  Kanban,
  Briefcase,
  UserRound,
  UsersRound,
  Target,
  Award,
  Calendar,
  BarChart3,
  Wallet,
  Settings,
  Sparkles,
  Crown,
} from "lucide-react";

/**
 * Papéis de acesso — espelha o enum Papel do Prisma (prisma/schema.prisma).
 * Mantido como union de string literal (em vez de importar o client gerado)
 * para não acoplar este módulo, usado também em Server/Client Components,
 * ao runtime do Prisma.
 */
export type Papel =
  | "admin"
  | "diretoria"
  | "consultor_comercial"
  | "recrutador"
  | "consultor_executive_search"
  | "financeiro"
  | "cliente_portal"
  | "candidato_portal";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** "all" = visível para qualquer papel autenticado da área interna. */
  roles: Papel[] | "all";
  /** Preenchido só para módulos ainda não construídos — ver plano-modulos.md. */
  fase?: string;
  descricao?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// Estrutura e visibilidade por papel conforme
// docs/business-platform/mapa-navegacao.md — não duplicar/decidir aqui,
// só refletir o que já está definido lá.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: "all" },
      {
        label: "CRM",
        href: "/crm",
        icon: Users,
        roles: ["admin", "diretoria", "consultor_comercial"],
        fase: "Fase 1",
        descricao: "Visão consolidada do CRM (pipeline comercial + clientes).",
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        label: "Executive Intelligence",
        href: "/intelligence",
        icon: Sparkles,
        roles: ["admin", "diretoria"],
        descricao: "Receita, pipeline ponderado, capacidade e alertas consolidados das três verticais.",
      },
      {
        label: "Modo CEO",
        href: "/intelligence/ceo",
        icon: Crown,
        roles: ["admin", "diretoria"],
        descricao: "O essencial do negócio em uma tela — sem ruído.",
      },
    ],
  },
  {
    label: "Pipelines",
    items: [
      {
        label: "Pipeline Comercial",
        href: "/crm/pipeline-comercial",
        icon: GitPullRequest,
        roles: ["admin", "diretoria", "consultor_comercial"],
        fase: "Fase 1",
        descricao: "Kanban de oportunidades — Lead até Ganho/Perdido.",
      },
      {
        label: "Pipeline de Vagas",
        href: "/ats/pipeline-vagas",
        icon: Kanban,
        roles: ["admin", "diretoria", "recrutador", "consultor_executive_search"],
        fase: "Fase 2",
        descricao: "Kanban de vagas — Abertas até Fechada/Perdida.",
      },
    ],
  },
  {
    label: "Registros",
    items: [
      {
        label: "Empresas",
        href: "/empresas",
        icon: Briefcase,
        roles: ["admin", "diretoria", "consultor_comercial", "recrutador", "financeiro"],
        fase: "Fase 1",
        descricao: "Base de empresas — clientes, prospects, contatos, segmento, histórico.",
      },
      {
        label: "Vagas",
        href: "/vagas",
        icon: Briefcase,
        roles: ["admin", "diretoria", "recrutador", "consultor_executive_search"],
        fase: "Fase 2",
        descricao: "Lista completa de vagas em todas as verticais.",
      },
      {
        label: "Candidatos",
        href: "/candidatos",
        icon: UserRound,
        roles: ["admin", "diretoria", "recrutador", "consultor_executive_search"],
        fase: "Fase 2",
        descricao: "Base de candidatos — perfil, busca avançada, histórico.",
      },
    ],
  },
  {
    label: "Verticais",
    items: [
      {
        label: "Alocação de Profissionais",
        href: "/alocacao",
        icon: UsersRound,
        roles: ["admin", "diretoria", "recrutador"],
        fase: "Fase 6",
        descricao: "Staffing — pool de talentos e contratos de alocação.",
      },
      {
        label: "Recrutamento & Seleção",
        href: "/recrutamento",
        icon: Target,
        roles: ["admin", "diretoria", "recrutador"],
        fase: "Fase 2",
        descricao: "Vagas de Tecnologia e Corporativo (não-executivas).",
      },
      {
        label: "Executive Search",
        href: "/executive-search",
        icon: Award,
        roles: ["admin", "diretoria", "consultor_executive_search"],
        fase: "Fase 6",
        descricao: "Busca executiva confidencial — C-level e board.",
      },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Agenda", href: "/agenda", icon: Calendar, roles: "all", fase: "Fase 9" },
      {
        label: "Relatórios",
        href: "/relatorios",
        icon: BarChart3,
        roles: ["admin", "diretoria", "financeiro"],
        fase: "Fase 3",
        descricao: "Dashboards salvos por área — exportação PDF/Excel.",
      },
      {
        label: "Financeiro",
        href: "/financeiro",
        icon: Wallet,
        roles: ["admin", "financeiro"],
        fase: "Fase 4",
        descricao: "Faturamento, comissões e receita recorrente.",
      },
      {
        label: "Configurações",
        href: "/configuracoes",
        icon: Settings,
        roles: ["admin", "diretoria", "consultor_comercial", "recrutador", "consultor_executive_search", "financeiro"],
        fase: "Fase 1",
        descricao: "Editor de pipelines, automações, usuários, papéis e integrações pessoais.",
      },
    ],
  },
];

const ALL_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isRoleAllowed(roles: NavItem["roles"], papel: Papel | null) {
  if (roles === "all") return true;
  if (!papel) return false;
  return roles.includes(papel);
}

export function getVisibleNavGroups(papel: Papel | null): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isRoleAllowed(item.roles, papel)),
  })).filter((group) => group.items.length > 0);
}

export function findNavItem(href: string): NavItem | undefined {
  return ALL_ITEMS.find((item) => item.href === href);
}

export const ROLE_LABEL: Record<Papel, string> = {
  admin: "Administrador",
  diretoria: "Diretoria",
  consultor_comercial: "Consultor Comercial",
  recrutador: "Recrutador",
  consultor_executive_search: "Consultor Executive Search",
  financeiro: "Financeiro",
  cliente_portal: "Cliente",
  candidato_portal: "Candidato",
};
