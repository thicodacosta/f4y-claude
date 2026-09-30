import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { exigirModulo } from "@/lib/contexto";
import { hoje as hojeCivil, hojeTexto, textoDeData } from "@/lib/datas";
import { cadencia, DURACOES, HORARIOS, RECORRENCIA } from "@/lib/feedback/avaliacao";
import { filtroPessoasFeedback } from "@/lib/feedback/regras";
import { agendarUmAUm } from "@/lib/feedback/avaliacoes-actions";
import { Cartao } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Agendar 1:1" };

export default async function AgendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("feedback", "criar");
  if (ctx.suporte) redirect("/feedback/agenda");
  const sp = await searchParams;
  const [pessoas, modelos] = await Promise.all([
    db.colaborador.findMany({
      where: filtroPessoasFeedback(ctx, escopo),
      select: {
        id: true,
        nome: true,
        cargo: true,
        gestorId: true,
        dataAdmissao: true,
        avaliacoesRecebidas: { orderBy: { data: "desc" }, take: 1, select: { data: true, periodicidade: true } },
      },
      orderBy: { nome: "asc" },
    }),
    db.modeloPauta.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  // Parâmetros de link validados: pessoa no escopo e feedback dessa mesma pessoa.
  const pessoa = pessoas.find((p) => p.id === sp.colaborador);
  const avaliacao = pessoa && sp.avaliacao && /^[0-9a-f-]{36}$/.test(sp.avaliacao) ? await db.avaliacaoFeedback.findFirst({ where: { id: sp.avaliacao, colaboradorId: pessoa.id }, select: { id: true } }) : null;
  const hoje = hojeTexto();
  let sugestao = hoje;
  if (pessoa) {
    const c = cadencia(pessoa.avaliacoesRecebidas[0] ?? null, pessoa.dataAdmissao, hojeCivil());
    if (c.proxima && textoDeData(c.proxima) > hoje) sugestao = textoDeData(c.proxima);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/feedback/agenda" className="text-sm text-muted-foreground hover:text-foreground">← Agenda 1:1</Link>
      <h2 className="font-heading text-2xl font-bold">Agendar 1:1</h2>
      {sp.colaborador && !pessoa && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">O colaborador do link não está entre as pessoas com quem você pode agendar.</p>
      )}
      <Cartao className="p-5">
        {pessoas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma pessoa ativa disponível para agendar.</p>
        ) : (
          <FormAcao action={agendarUmAUm} textoBotao="Agendar">
            {avaliacao && <input type="hidden" name="avaliacaoId" value={avaliacao.id} />}
            <Selecao
              nome="colaboradorId"
              rotulo="Colaborador"
              required
              defaultValue={pessoa?.id ?? ""}
              ajuda="O 1:1 é com o gestor direto registrado no cadastro."
              opcoes={[{ valor: "", rotulo: "Selecione…" }, ...pessoas.map((p) => ({ valor: p.id, rotulo: `${p.nome}${p.cargo ? ` — ${p.cargo}` : ""}${p.gestorId ? "" : " (sem gestor)"}` }))]}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo nome="data" rotulo="Data" type="date" min={hoje} defaultValue={sugestao} required ajuda={pessoa && sugestao !== hoje ? "Sugerida pela cadência." : undefined} />
              <Selecao nome="horario" rotulo="Horário" defaultValue="10:00" opcoes={HORARIOS.map((h) => ({ valor: h, rotulo: h }))} />
              <Selecao nome="duracao" rotulo="Duração" defaultValue="30" opcoes={DURACOES.map((d) => ({ valor: String(d), rotulo: `${d} minutos` }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Selecao nome="recorrencia" rotulo="Recorrência" opcoes={Object.entries(RECORRENCIA).map(([valor, rotulo]) => ({ valor, rotulo }))} ajuda="Cria a reunião inicial e as próximas 3, vinculadas numa série." />
              <Selecao nome="modeloId" rotulo="Pauta" opcoes={[{ valor: "", rotulo: "Sem modelo de pauta" }, ...modelos.map((m) => ({ valor: m.id, rotulo: m.nome }))]} />
            </div>
            <Area nome="observacoes" rotulo="Notas do agendamento" rows={3} maxLength={2000} />
          </FormAcao>
        )}
      </Cartao>
    </div>
  );
}
