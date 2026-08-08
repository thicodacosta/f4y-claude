import { z } from "zod";

export const statusFaturamentoValues = ["pendente", "faturado", "pago"] as const;
export const statusFaturamentoLabel: Record<(typeof statusFaturamentoValues)[number], string> = {
  pendente: "Pendente",
  faturado: "Faturado",
  pago: "Pago",
};

export const statusComissaoValues = ["pendente", "aprovada", "paga"] as const;
export const statusComissaoLabel: Record<(typeof statusComissaoValues)[number], string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  paga: "Paga",
};

/** Próximo status válido — os dois fluxos são lineares (sem retroceder por
 * enquanto, ver plano-modulos.md Fase 4: "financeiro fecha o mês sem
 * planilha paralela", não um workflow de aprovação reversível). */
export const proximoStatusFaturamento: Record<(typeof statusFaturamentoValues)[number], (typeof statusFaturamentoValues)[number] | null> = {
  pendente: "faturado",
  faturado: "pago",
  pago: null,
};

export const proximoStatusComissao: Record<(typeof statusComissaoValues)[number], (typeof statusComissaoValues)[number] | null> = {
  pendente: "aprovada",
  aprovada: "paga",
  paga: null,
};

export const atualizarStatusFaturamentoSchema = z.object({
  faturamentoId: z.string().uuid(),
  novoStatus: z.enum(statusFaturamentoValues),
});

export const atualizarStatusComissaoSchema = z.object({
  comissaoId: z.string().uuid(),
  novoStatus: z.enum(statusComissaoValues),
});

export const marcarFaturamentoFlagSchema = z.object({
  faturamentoId: z.string().uuid(),
});

export const atualizarRegraComissaoSchema = z.object({
  vertical: z.enum(["tecnologia", "corporativo", "executive_search", "alocacao_tech"]),
  percentualConsultor: z.coerce.number().min(0).max(100),
  percentualRecrutador: z.coerce.number().min(0).max(100),
});

export type AtualizarRegraComissaoFormInput = z.input<typeof atualizarRegraComissaoSchema>;
