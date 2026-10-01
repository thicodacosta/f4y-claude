"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transacao } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { completarJson, ErroIa, iaDisponivel } from "@/lib/ia";
import { dentroDoLimite } from "@/lib/limite";
import { hoje } from "@/lib/datas";
import { nomeMotivo } from "@/lib/offboarding/motivos";
import { configSchema } from "./referencias";
import { carregarPeopleAnalytics } from "./indicadores";
import { resolverPeriodo } from "./calculo";
import { comparativo, gerarInsights } from "./insights";

/** Referências de mercado e premissas de custo da organização (Admin: People Analytics › Editar). */
export async function salvarReferencias(json: string): Promise<{ ok?: string; erro?: string }> {
  try {
    const { ctx } = await exigirPermissaoAcao("analytics", "editar");
    const d = configSchema.parse(JSON.parse(json));
    await transacao({ escopo: "tenant", tenantId: ctx.org.id, usuarioId: ctx.usuario.id }, async (tx) => {
      await tx.configuracaoAnalytics.upsert({
        where: { tenantId: ctx.org.id },
        update: { referencias: d, atualizadoPor: ctx.usuario.nome },
        create: { tenantId: ctx.org.id, referencias: d, atualizadoPor: ctx.usuario.nome },
      });
      await auditar(tx, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "analytics.referencias", entidade: "configuracao_analytics", detalhes: d });
    });
    revalidatePath("/people-analytics", "layout");
    return { ok: "Referências salvas. O comparativo e os insights já usam os novos valores." };
  } catch (e) {
    if (e instanceof z.ZodError) return { erro: "Valores inválidos. Revise os campos." };
    return { erro: e instanceof ErroAcesso ? e.message : "Não foi possível salvar." };
  }
}

const analiseSchema = z.object({
  resumo_executivo: z.string().min(1).max(3000),
  destaques: z.array(z.string().max(500)).max(8),
  riscos: z.array(z.string().max(500)).max(8),
  recomendacoes: z.array(z.object({ acao: z.string().max(500), prioridade: z.string().max(40), prazo: z.string().max(80), indicador: z.string().max(160) })).max(8),
});
export type AnaliseIa = z.infer<typeof analiseSchema>;

/**
 * Análise executiva por IA a partir SÓ de indicadores agregados (nenhum nome,
 * e-mail, resposta individual ou texto livre de colaborador é enviado).
 */
export async function gerarAnaliseIa(params: { periodo?: string; de?: string; ate?: string; area?: string }): Promise<{ analise?: AnaliseIa; erro?: string }> {
  try {
    const { ctx, db } = await exigirPermissaoAcao("analytics", "visualizar");
    if (!iaDisponivel()) return { erro: "Nenhum serviço de IA está configurado nesta instalação." };
    if (!dentroDoLimite(`analytics:ia:${ctx.org.id}`, 10, 60 * 60_000)) return { erro: "Limite de análises por hora atingido. Tente mais tarde." };
    const areaId = z.string().uuid().safeParse(params.area).success ? params.area! : null;
    const periodo = resolverPeriodo(params, hoje());
    const d = await carregarPeopleAnalytics(ctx, periodo, areaId);
    const area = areaId ? d.areas.find((a) => a.id === areaId)?.nome : null;
    const dados = {
      periodo: periodo.rotulo,
      recorte: area ?? "organização inteira",
      pessoas: d.pessoas,
      turnover: d.turnover,
      turnoverPeriodoAnterior: d.turnoverAnterior,
      turnover12m: d.turnover12m,
      serieMensal: d.serie.map((p) => ({ mes: p.rotulo, headcount: p.headcount, admissoes: p.admissoes, saidas: p.saidas, turnover: p.turnover })),
      porArea: d.porArea,
      saidasPorTempoDeCasa: d.casa.map((c) => ({ faixa: c.nome, saidas: c.n })),
      entrevistasDesligamento: d.saida && {
        ...d.saida,
        motivosReais: d.saida.motivosReais.map((m) => ({ motivo: nomeMotivo(m.chave), n: m.n })),
        motivosDeclarados: d.saida.motivosDeclarados.map((m) => ({ motivo: nomeMotivo(m.chave), n: m.n })),
        principaisReais: d.saida.principaisReais.map((m) => ({ motivo: nomeMotivo(m.chave), n: m.n })),
      },
      riscoDeSaida: d.riscos && { alto: d.riscos.filter((r) => r.nivel === "alto").length, medio: d.riscos.filter((r) => r.nivel === "medio").length, talentosEmRisco: d.riscos.filter((r) => r.talentoChave && r.nivel !== "baixo").length },
      projecao90dias: d.projecao,
      atracao: d.atracao,
      onboarding: d.onboarding,
      feedback: d.feedback,
      pdi: d.pdi,
      pulse: d.pulse && { pesquisas: d.pulse.pesquisas, adesao: d.pulse.adesao, enps: d.pulse.enps },
      nr1: d.nr1,
      acoesRetencao: d.acoesRetencao,
      comparativo: comparativo(d).map((c) => ({ indicador: c.nome, valor: c.valor, referencia: c.referencia, leitura: c.leitura })),
      insightsDasRegras: gerarInsights(d).map((i) => i.titulo),
    };
    const analise = await completarJson({
      sistema:
        "Você é especialista sênior em People Analytics e gestão de pessoas no Brasil. Analise APENAS os indicadores agregados fornecidos (não invente números). " +
        "Escreva em português do Brasil, tom consultivo e executivo, para diretoria e RH. Relacione causas e efeitos entre os módulos (atração, integração, desenvolvimento, clima, saúde e turnover). " +
        "As referências de comparação são valores configurados pela empresa, não dados oficiais. Não faça recomendações sobre pessoas específicas. " +
        'Responda somente com JSON: {"resumo_executivo": string, "destaques": string[], "riscos": string[], "recomendacoes": [{"acao": string, "prioridade": "alta"|"média"|"baixa", "prazo": string, "indicador": string}]}',
      usuario: JSON.stringify(dados),
      schema: analiseSchema,
      maxTokens: 2500,
    });
    await auditar(db, {
      tenantId: ctx.org.id,
      usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome },
      acao: "analytics.ia",
      entidade: "people_analytics",
      detalhes: { periodo: periodo.rotulo, recorte: area ?? null },
    });
    return { analise };
  } catch (e) {
    return { erro: e instanceof ErroIa || e instanceof ErroAcesso ? e.message : "Não foi possível gerar a análise agora." };
  }
}
