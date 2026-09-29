import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LifeBuoy, ShieldCheck } from "lucide-react";
import { exigirContexto } from "@/lib/contexto";
import { dbTenant } from "@/lib/db";
import { filtroCiclosParaResponder, FREQUENCIA } from "@/lib/nr1/regras";
import { responderNr1 } from "@/lib/nr1/actions";
import { formatarData } from "@/lib/formato";
import { Cartao } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";

export const metadata: Metadata = { title: "Participar do diagnóstico" };

export default async function ResponderNr1({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirContexto();
  if (!/^[0-9a-f-]{36}$/.test(id) || !ctx.colaboradorId || ctx.suporte) notFound();
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const eu = await db.colaborador.findUnique({ where: { id: ctx.colaboradorId }, select: { id: true, equipeId: true, status: true } });
  if (!eu || eu.status !== "ativo") notFound();
  const c = await db.cicloNr1.findFirst({
    where: { AND: [{ id }, filtroCiclosParaResponder(eu.id, eu.equipeId)] },
    include: { dimensoes: { orderBy: { ordem: "asc" }, include: { perguntas: { orderBy: { ordem: "asc" } } } } },
  });
  if (!c) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/nr1" className="text-sm text-muted-foreground hover:text-foreground">
        ← Diagnóstico NR-1
      </Link>
      <div>
        <h2 className="font-heading text-2xl font-bold">{c.titulo}</h2>
        {c.encerraEm && <p className="text-sm text-muted-foreground">Aberto até {formatarData(c.encerraEm)}</p>}
      </div>
      <p className="flex items-start gap-2 rounded-lg border border-teal/30 bg-teal-soft px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-strong" aria-hidden />
        <span>
          Sua participação é <strong>anônima</strong>. As respostas não guardam quem respondeu nem quando, e os resultados só aparecem agregados, com no mínimo {ctx.org.minimoRecorte}{" "}
          participantes por recorte. Responda pensando nas <strong>últimas quatro semanas</strong>.
        </span>
      </p>
      {c.descricao && <p className="text-sm leading-relaxed whitespace-pre-line">{c.descricao}</p>}

      <FormAcao action={responderNr1} textoBotao="Enviar participação">
        <input type="hidden" name="cicloId" value={c.id} />
        {c.dimensoes.map((d) => (
          <Cartao key={d.id} className="p-5">
            <h3 className="font-heading text-base font-bold">{d.nome}</h3>
            <div className="mt-3 flex flex-col gap-5">
              {d.perguntas.map((q) => (
                <fieldset key={q.id} className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm">{q.texto}</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {FREQUENCIA.map(([v, r]) => (
                      <label key={v} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-teal-soft has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
                        <input type="radio" name={`q_${q.id}`} value={v} required className="accent-[var(--primary)]" />
                        {r}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </Cartao>
        ))}
      </FormAcao>

      <p className="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <LifeBuoy className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Este questionário não é canal de denúncia nem de atendimento. Em situações de assédio ou violência, use o canal de denúncia da sua organização. Se você estiver em sofrimento
          emocional, procure apoio profissional — o CVV atende 24 horas pelo telefone 188; em emergência, ligue 192 (SAMU).
        </span>
      </p>
    </div>
  );
}
