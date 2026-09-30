import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirModulo, pode } from "@/lib/contexto";
import { hoje, somarDias, textoDeData } from "@/lib/datas";
import { formatarData } from "@/lib/formato";
import { notasDe } from "@/lib/feedback/avaliacao";
import { filtroAvaliacoes } from "@/lib/feedback/regras";
import { CHAVES_FOCO, sugerirFocos, type FocoChave, type SugestaoFoco } from "@/lib/pdi/focos";
import { filtroPessoasPdi } from "@/lib/pdi/regras";
import { pessoaParaForm, SELECAO_PESSOA } from "@/lib/pdi/formulario";
import { AssistentePdi } from "@/components/pdi/assistente";
import { focoVazio, type PdiForm } from "@/lib/pdi/form";

export const metadata: Metadata = { title: "Novo PDI" };

const ID = /^[0-9a-f-]{36}$/;

/**
 * Fluxo guiado de criação. Aceita pré-preenchimento (nada é gravado antes da
 * confirmação): ?colaborador=, ?avaliacao=&focos= (Feedback 1:1, se contratado)
 * e ?origem=onboarding&onboarding= (Onboarding, se contratado).
 */
export default async function NovoPdiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { ctx, db } = await exigirModulo("pdi");
  const escopo = pode(ctx, "pdi", "criar");
  if (!escopo || ctx.suporte) redirect("/pdi");
  const bruto = await searchParams;
  const sp = Object.fromEntries(Object.entries(bruto).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string | undefined>;
  // Focos escolhidos na prévia do feedback (?foco=a&foco=b) ou em lista (?focos=a,b).
  const focosPedidos = [...[bruto.foco ?? []].flat(), ...(sp.focos ?? "").split(",")].filter(Boolean);
  const pessoas = await db.colaborador.findMany({ where: { AND: [filtroPessoasPdi(ctx, escopo), { status: "ativo" }] }, select: SELECAO_PESSOA, orderBy: { nome: "asc" } });

  const h = hoje();
  const colaboradorId = sp.colaborador && ID.test(sp.colaborador) && pessoas.some((p) => p.id === sp.colaborador) ? sp.colaborador : "";
  const nome = pessoas.find((p) => p.id === colaboradorId)?.nome;
  const inicial: PdiForm = {
    colaboradorId,
    titulo: nome ? `Desenvolvimento · ${nome}` : "",
    descricao: "",
    inicio: textoDeData(h),
    fim: textoDeData(somarDias(h, 180)),
    origem: "manual",
    focos: [],
  };

  // Ponte Feedback 1:1 → PDI: sugestões recalculadas no servidor a partir do feedback (escala 1–5).
  let sugestoes: SugestaoFoco[] | undefined;
  let aviso: string | null = null;
  const escopoFeedback = pode(ctx, "feedback", "visualizar");
  if (sp.avaliacao && ID.test(sp.avaliacao) && ctx.modulos.has("feedback") && escopoFeedback) {
    const a = await db.avaliacaoFeedback.findFirst({ where: { AND: [{ id: sp.avaliacao }, filtroAvaliacoes(ctx, escopoFeedback)] } });
    if (a && pessoas.some((p) => p.id === a.colaboradorId)) {
      const escolhidos = focosPedidos.filter((c): c is FocoChave => (CHAVES_FOCO as readonly string[]).includes(c));
      // Vindo da prévia (previa=1), vale exatamente o que foi marcado; sem prévia, todas as sugestões.
      sugestoes = sugerirFocos(notasDe(a)).filter((s) => (sp.previa === "1" || escolhidos.length ? escolhidos.includes(s.chave) : true));
      inicial.colaboradorId = a.colaboradorId;
      inicial.titulo = `Desenvolvimento · ${pessoas.find((p) => p.id === a.colaboradorId)!.nome}`;
      inicial.origem = "feedback";
      inicial.origemId = a.id;
      inicial.descricao = `Plano elaborado a partir do feedback 1:1 de ${formatarData(a.data)}.`;
      inicial.focos = sugestoes.map((s) =>
        focoVazio(s.chave, {
          importancia: `Ponto de desenvolvimento no feedback de ${formatarData(a.data)}: ${s.criterios.map((c) => `${c.nome} (nota ${c.nota} de 5)`).join(", ")}.`,
          objetivo: s.objetivo,
        }),
      );
    } else aviso = "O feedback informado não está disponível para você; o PDI pode ser criado manualmente.";
  }

  // Onboarding → PDI: só sugere; a pessoa revisa e confirma.
  if (sp.origem === "onboarding" && sp.onboarding && ID.test(sp.onboarding) && ctx.modulos.has("onboarding") && pode(ctx, "onboarding", "visualizar")) {
    const o = await db.onboarding.findUnique({ where: { id: sp.onboarding }, select: { id: true, colaboradorId: true } });
    if (o && pessoas.some((p) => p.id === o.colaboradorId)) {
      inicial.colaboradorId = o.colaboradorId;
      inicial.titulo = `Desenvolvimento pós-onboarding · ${pessoas.find((p) => p.id === o.colaboradorId)!.nome}`;
      inicial.origem = "onboarding";
      inicial.origemId = o.id;
      inicial.descricao = "Plano sugerido na revisão de 90 dias do onboarding.";
    }
  }

  return (
    <section aria-labelledby="titulo" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/pdi" className="text-sm text-muted-foreground hover:text-foreground">
          ← PDI
        </Link>
        <h2 id="titulo" className="font-heading text-lg font-bold">
          Novo PDI
        </h2>
        {inicial.origem === "feedback" && <p className="text-sm text-muted-foreground">Pré-preenchido com as sugestões do feedback 1:1. Nada é salvo até você confirmar na revisão.</p>}
        {inicial.origem === "onboarding" && <p className="text-sm text-muted-foreground">Sugerido a partir do onboarding. Nada é salvo até você confirmar na revisão.</p>}
      </div>
      {aviso && (
        <p role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          {aviso}
        </p>
      )}
      {pessoas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-input bg-card p-6 text-sm text-muted-foreground">Não há colaboradores ativos no seu escopo para criar um PDI.</p>
      ) : (
        <AssistentePdi pessoas={pessoas.map(pessoaParaForm)} inicial={inicial} sugestoes={sugestoes} />
      )}
    </section>
  );
}
