import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { exigirModulo, pode } from "@/lib/contexto";
import { filtroVagas } from "@/lib/crm/consultas";
import { STATUS_CANDIDATURA, STATUS_VAGA } from "@/lib/crm/normalizar";
import { formatarData } from "@/lib/formato";
import { FormVaga } from "@/components/crm/form-vaga";
import { Celula, Tabela } from "@/components/app/tabela";
import { EstadoVazio, Selo } from "@/components/app/lista";

export const metadata: Metadata = { title: "Vaga" };

export default async function VagaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, escopo, db } = await exigirModulo("crm");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const vaga = await db.vaga.findFirst({
    where: { AND: [{ id }, filtroVagas(ctx, escopo)] },
    include: {
      candidaturas: { include: { candidato: { select: { id: true, nome: true, cidade: true, uf: true } } }, orderBy: { atualizadoEm: "desc" } },
    },
  });
  if (!vaga) notFound();
  const [equipes, gestores] = await Promise.all([
    db.equipe.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.colaborador.findMany({ where: { status: "ativo" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  const resumo = Object.entries(STATUS_CANDIDATURA)
    .map(([k, s]) => ({ nome: s.nome, n: vaga.candidaturas.filter((c) => c.status === k).length }))
    .filter((r) => r.n > 0);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/crm/vagas" className="text-sm text-muted-foreground hover:text-foreground">← Vagas</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-bold">{vaga.titulo}</h2>
          <Selo tom={STATUS_VAGA[vaga.status].tom}>{STATUS_VAGA[vaga.status].nome}</Selo>
        </div>
        <p className="text-sm text-muted-foreground">
          Aberta em {formatarData(vaga.abertaEm)} por {vaga.criadoPor}
          {vaga.fechadaEm && ` · encerrada em ${formatarData(vaga.fechadaEm)}`}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="font-heading text-lg font-bold">Candidatos ({vaga.candidaturas.length})</h3>
        {resumo.length > 0 && (
          <p className="flex flex-wrap gap-2 text-sm">
            {resumo.map((r) => (
              <span key={r.nome} className="rounded-full bg-muted px-3 py-1">{r.nome}: <strong className="tabular-nums">{r.n}</strong></span>
            ))}
          </p>
        )}
        {vaga.candidaturas.length === 0 ? (
          <EstadoVazio titulo="Nenhum candidato associado" descricao="Associe candidatos a esta vaga a partir da ficha de cada candidato." />
        ) : (
          <Tabela colunas={["Candidato", "Localização", "Situação", "Atualizado"]} minWidth={600}>
            {vaga.candidaturas.map((c) => (
              <tr key={c.id}>
                <Celula><Link href={`/crm/candidatos/${c.candidato.id}`} className="font-medium hover:text-teal-strong">{c.candidato.nome}</Link></Celula>
                <Celula className="text-muted-foreground">{[c.candidato.cidade, c.candidato.uf].filter(Boolean).join("/") || "—"}</Celula>
                <Celula><Selo tom={STATUS_CANDIDATURA[c.status].tom}>{STATUS_CANDIDATURA[c.status].nome}</Selo></Celula>
                <Celula className="tabular-nums text-muted-foreground">{formatarData(c.atualizadoEm)}</Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-heading text-lg font-bold">Dados da vaga</h3>
        <FormVaga v={vaga} equipes={equipes} gestores={gestores} somenteLeitura={!pode(ctx, "crm", "editar")} />
      </section>
    </>
  );
}
