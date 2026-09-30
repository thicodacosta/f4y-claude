import "server-only";

import type { Escopo } from "@/lib/permissoes";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Diagnósticos visíveis na gestão interna:
 *  todos  (RH/Admin) → todos, inclusive rascunhos
 *  equipe (gestor, se a empresa conceder) → só encerrados (resultados das áreas que lidera, conferidos no banco)
 * Colaborador não acessa o módulo interno (escopo mínimo em lib/contexto.ts): responde pelo link do convite.
 */
export function filtroCiclos(escopo: Escopo | null): Prisma.CicloNr1WhereInput {
  if (escopo === "todos") return {};
  if (escopo === "equipe") return { status: "encerrado" };
  return { id: "00000000-0000-0000-0000-000000000000" };
}

export const AVISO_NR1 =
  "Instrumento de apoio ao levantamento de fatores de risco psicossociais relacionados ao trabalho. Os scores são indicativos da pesquisa: " +
  "não constituem diagnóstico clínico, laudo técnico, certificação nem prova de conformidade com a NR-1, e não substituem a avaliação dos " +
  "profissionais de SST responsáveis pelo GRO/PGR.";

export const STATUS_CICLO = {
  rascunho: { nome: "Rascunho", tom: "neutro" },
  aberto: { nome: "Ativo", tom: "info" },
  encerrado: { nome: "Encerrado", tom: "sucesso" },
} as const;

export const AUDIENCIA_NR1 = { todos: "Todos os colaboradores ativos", departamentos: "Departamentos selecionados", colaboradores: "Colaboradores selecionados" } as const;

export const PRIORIDADE = {
  alta: { nome: "Alta", tom: "perigo" },
  media: { nome: "Média", tom: "alerta" },
  baixa: { nome: "Baixa", tom: "neutro" },
} as const;

export const STATUS_RISCO = {
  identificado: "Identificado",
  em_tratamento: "Em tratamento",
  monitorado: "Monitorado",
  encerrado: "Encerrado",
} as const;

export const STATUS_ACAO_NR1 = {
  pendente: { nome: "Pendente", tom: "neutro" },
  em_andamento: { nome: "Em andamento", tom: "info" },
  concluida: { nome: "Concluída", tom: "sucesso" },
  cancelada: { nome: "Cancelada", tom: "neutro" },
} as const;
