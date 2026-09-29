import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { exigirContexto } from "@/lib/contexto";
import { dbTenant } from "@/lib/db";
import { filtroParaResponder } from "@/lib/pulse/regras";
import { responderPulse } from "@/lib/pulse/actions";
import { formatarData } from "@/lib/formato";
import { Cartao } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";

export const metadata: Metadata = { title: "Responder pesquisa" };

const ESCALA = [
  [1, "Discordo totalmente"],
  [2, "Discordo"],
  [3, "Neutro"],
  [4, "Concordo"],
  [5, "Concordo totalmente"],
] as const;

function Opcao({ nome, valor, rotulo, obrigatoria }: { nome: string; valor: number; rotulo: string; obrigatoria: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-teal-soft has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
      <input type="radio" name={nome} value={valor} required={obrigatoria} className="accent-[var(--primary)]" />
      {rotulo}
    </label>
  );
}

export default async function ResponderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirContexto();
  if (!/^[0-9a-f-]{36}$/.test(id) || !ctx.colaboradorId || ctx.suporte) notFound();
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const eu = await db.colaborador.findUnique({ where: { id: ctx.colaboradorId }, select: { id: true, equipeId: true, status: true } });
  if (!eu || eu.status !== "ativo") notFound();
  // Só abre se a pesquisa estiver aberta, a pessoa estiver no público e ainda não tiver respondido.
  const p = await db.pesquisaPulse.findFirst({
    where: { AND: [{ id }, filtroParaResponder(eu.id, eu.equipeId)] },
    include: { perguntas: { orderBy: { ordem: "asc" } } },
  });
  if (!p) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link href="/pulse" className="text-sm text-muted-foreground hover:text-foreground">
        ← Pulse
      </Link>
      <div>
        <h2 className="font-heading text-2xl font-bold">{p.titulo}</h2>
        {p.encerraEm && <p className="text-sm text-muted-foreground">Aberta até {formatarData(p.encerraEm)}</p>}
      </div>
      <p className="flex items-start gap-2 rounded-lg border border-teal/30 bg-teal-soft px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-strong" aria-hidden />
        <span>
          Sua resposta é <strong>anônima</strong>: não guardamos quem respondeu cada resposta nem o horário, e os resultados só aparecem agregados, com no mínimo{" "}
          {ctx.org.minimoRecorte} respondentes por recorte. Registramos apenas que você participou, para não pedir de novo.
        </span>
      </p>
      {p.descricao && <p className="text-sm leading-relaxed whitespace-pre-line">{p.descricao}</p>}

      <FormAcao action={responderPulse} textoBotao="Enviar respostas">
        <input type="hidden" name="pesquisaId" value={p.id} />
        {p.perguntas.map((q, n) => (
          <Cartao key={q.id} className="p-5">
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-sm font-semibold">
                {n + 1}. {q.texto}
                {!q.obrigatoria && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
              </legend>
              {q.tipo === "escala" && (
                <div className="grid gap-2 sm:grid-cols-5">
                  {ESCALA.map(([v, r]) => (
                    <Opcao key={v} nome={`q_${q.id}`} valor={v} rotulo={r} obrigatoria={q.obrigatoria} />
                  ))}
                </div>
              )}
              {q.tipo === "enps" && (
                <>
                  <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
                    {Array.from({ length: 11 }, (_, v) => (
                      <Opcao key={v} nome={`q_${q.id}`} valor={v} rotulo={String(v)} obrigatoria={q.obrigatoria} />
                    ))}
                  </div>
                  <p className="flex justify-between text-xs text-muted-foreground">
                    <span>0 · nada provável</span>
                    <span>10 · muito provável</span>
                  </p>
                </>
              )}
              {q.tipo === "sim_nao" && (
                <div className="grid grid-cols-2 gap-2 sm:w-64">
                  <Opcao nome={`q_${q.id}`} valor={1} rotulo="Sim" obrigatoria={q.obrigatoria} />
                  <Opcao nome={`q_${q.id}`} valor={0} rotulo="Não" obrigatoria={q.obrigatoria} />
                </div>
              )}
              {q.tipo === "texto" && (
                <>
                  <label htmlFor={`q_${q.id}`} className="sr-only">
                    Comentário
                  </label>
                  <textarea
                    id={`q_${q.id}`}
                    name={`q_${q.id}`}
                    rows={3}
                    maxLength={1000}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <p className="text-xs text-muted-foreground">Evite nomes, datas ou detalhes que possam identificar você ou colegas.</p>
                </>
              )}
            </fieldset>
          </Cartao>
        ))}
      </FormAcao>
    </div>
  );
}
