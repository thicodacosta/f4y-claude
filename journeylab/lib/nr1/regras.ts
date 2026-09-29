import "server-only";

import type { Escopo } from "@/lib/permissoes";
import type { Prisma } from "@/lib/generated/prisma/client";
import { hoje as hojeCivil } from "@/lib/datas";

/** Ciclos visíveis: todos → todos; equipe → abertos/encerrados com público nas equipes lideradas. */
export function filtroCiclos(escopo: Escopo, minhasEquipes: string[]): Prisma.CicloNr1WhereInput {
  if (escopo === "todos") return {};
  if (escopo === "equipe" && minhasEquipes.length) {
    return { status: { not: "rascunho" }, OR: [{ publicoTodos: true }, { equipeIds: { hasSome: minhasEquipes } }] };
  }
  return { id: "00000000-0000-0000-0000-000000000000" };
}

export function filtroCiclosParaResponder(colaboradorId: string, equipeId: string | null): Prisma.CicloNr1WhereInput {
  const hoje = hojeCivil();
  return {
    status: "aberto",
    OR: [{ encerraEm: null }, { encerraEm: { gte: hoje } }],
    AND: [{ OR: [{ publicoTodos: true }, ...(equipeId ? [{ equipeIds: { has: equipeId } }] : [])] }],
    participacoes: { none: { colaboradorId } },
  };
}

/** Faixas do índice de favorabilidade — orientam priorização, não são diagnóstico. */
export function faixa(indice: number) {
  if (indice >= 70) return { nome: "Favorável", tom: "sucesso" as const };
  if (indice >= 50) return { nome: "Atenção", tom: "alerta" as const };
  return { nome: "Prioritário", tom: "perigo" as const };
}

export const AVISO_NR1 =
  "Ferramenta de apoio à identificação e à gestão de fatores de risco psicossociais no gerenciamento de riscos ocupacionais. " +
  "Não constitui avaliação clínica, diagnóstico de saúde, laudo técnico nem parecer jurídico. A interpretação dos resultados e a definição " +
  "das medidas devem envolver os profissionais responsáveis pela segurança e saúde no trabalho da organização.";

export const FREQUENCIA = [
  [1, "Nunca"],
  [2, "Raramente"],
  [3, "Às vezes"],
  [4, "Frequentemente"],
  [5, "Sempre"],
] as const;

export const STATUS_CICLO = {
  rascunho: { nome: "Rascunho", tom: "neutro" },
  aberto: { nome: "Aberto", tom: "info" },
  encerrado: { nome: "Encerrado", tom: "sucesso" },
} as const;

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

export { QUESTIONARIO_REFERENCIA } from "./questionario";
