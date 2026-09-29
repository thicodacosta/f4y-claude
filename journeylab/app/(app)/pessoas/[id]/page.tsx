import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { dbTenant } from "@/lib/db";
import { exigirContexto, filtroColaboradores, pode } from "@/lib/contexto";
import { formatarData } from "@/lib/formato";
import { FormPessoa } from "@/components/cadastro/form-pessoa";
import { Selo } from "@/components/app/lista";
import { STATUS_PESSOA } from "@/lib/rotulos";
import { filtroOnboardings } from "@/lib/onboarding/regras";
import { filtroCandidatos } from "@/lib/crm/consultas";
import { filtroReunioes } from "@/lib/feedback/regras";
import { filtroPdis, progressoPdi, STATUS_PDI } from "@/lib/pdi/regras";
import { formatarDataHora } from "@/lib/formato";
import { Cartao } from "@/components/app/painel";
import { ICONE_MODULO } from "@/components/app/icones-modulo";

export const metadata: Metadata = { title: "Pessoa" };

export default async function PessoaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirContexto();
  const escopo = pode(ctx, "cadastro", "visualizar");
  if (!escopo) redirect("/inicio");
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  // Busca já restrita ao escopo do papel e (via RLS) à organização ativa.
  const pessoa = await db.colaborador.findFirst({
    where: { AND: [{ id }, filtroColaboradores(ctx, escopo)] },
    include: { associacao: { include: { usuario: { select: { email: true } }, papel: { select: { nome: true } } } } },
  });
  if (!pessoa) notFound();
  const podeEditar = pode(ctx, "cadastro", "editar") === "todos";
  // Integração: só consulta o Onboarding se o módulo estiver ativo e o papel puder ver.
  const escopoOnb = pode(ctx, "onboarding", "visualizar");
  const onboardings = escopoOnb
    ? await db.onboarding.findMany({
        where: { AND: [{ colaboradorId: pessoa.id }, filtroOnboardings(ctx, escopoOnb)] },
        include: { tarefas: { select: { status: true } } },
        orderBy: { inicio: "desc" },
      })
    : [];
  // Jornada integrada: cada bloco só aparece se o módulo estiver ativo E o papel puder ver
  // aquele dado desta pessoa. Pulse e NR-1 nunca aparecem por pessoa (anonimato).
  const escopoCrm = pode(ctx, "crm", "visualizar");
  const escopoFb = pode(ctx, "feedback", "visualizar");
  const escopoPdi = pode(ctx, "pdi", "visualizar");
  const agora = new Date();
  const [candidato, proximo1a1, realizados, compromissosAbertos, pdi] = await Promise.all([
    escopoCrm && pessoa.candidatoOrigemId
      ? db.candidato.findFirst({ where: { AND: [{ id: pessoa.candidatoOrigemId }, filtroCandidatos(ctx, escopoCrm)] }, select: { id: true, criadoEm: true } })
      : null,
    escopoFb ? db.reuniao.findFirst({ where: { AND: [{ colaboradorId: pessoa.id, status: "agendada", dataHora: { gte: agora } }, filtroReunioes(ctx, escopoFb)] }, orderBy: { dataHora: "asc" } }) : null,
    escopoFb ? db.reuniao.count({ where: { AND: [{ colaboradorId: pessoa.id, status: "realizada" }, filtroReunioes(ctx, escopoFb)] } }) : 0,
    escopoFb ? db.compromisso.count({ where: { responsavelId: pessoa.id, status: "aberto", reuniao: filtroReunioes(ctx, escopoFb) } }) : 0,
    escopoPdi
      ? db.pdi.findFirst({ where: { AND: [{ colaboradorId: pessoa.id }, filtroPdis(ctx, escopoPdi)] }, orderBy: { criadoEm: "desc" }, include: { acoes: { select: { status: true } } } })
      : null,
  ]);
  const jornada = [
    candidato && { chave: "crm", titulo: "Origem no CRM", texto: `Candidato cadastrado em ${formatarData(candidato.criadoEm)}`, href: `/crm/candidatos/${candidato.id}` },
    escopoFb && {
      chave: "feedback",
      titulo: "Feedback 1:1",
      texto: `${proximo1a1 ? `Próximo 1:1 em ${formatarDataHora(proximo1a1.dataHora.toISOString())}` : "Sem 1:1 agendado"} · ${realizados} realizado(s) · ${compromissosAbertos} compromisso(s) aberto(s)`,
      href: proximo1a1 ? `/feedback/${proximo1a1.id}` : "/feedback",
    },
    escopoPdi && {
      chave: "pdi",
      titulo: "PDI",
      texto: pdi ? `${pdi.titulo} · ${STATUS_PDI[pdi.status].nome} · ${progressoPdi(pdi.acoes)}% concluído` : "Sem PDI",
      href: pdi ? `/pdi/${pdi.id}` : "/pdi",
    },
  ].filter(Boolean) as { chave: string; titulo: string; texto: string; href: string }[];

  const [equipes, gestores] = await Promise.all([
    db.equipe.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.colaborador.findMany({ where: { status: { not: "desligado" } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/pessoas" className="text-sm text-muted-foreground hover:text-foreground">← Pessoas</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold">{pessoa.nome}</h1>
          <Selo tom={STATUS_PESSOA[pessoa.status].tom}>{STATUS_PESSOA[pessoa.status].nome}</Selo>
        </div>
        <p className="text-sm text-muted-foreground">
          {pessoa.associacao
            ? `Acesso à plataforma: ${pessoa.associacao.usuario.email} · ${pessoa.associacao.papel.nome}`
            : "Sem acesso à plataforma. Convide em Configurações › Usuários, vinculando a esta pessoa."}
          {pessoa.candidatoOrigemId && " · Originada de candidato no CRM."}
          {pessoa.desligadoEm && ` · Desligada em ${formatarData(pessoa.desligadoEm)}.`}
        </p>
      </div>
      {jornada.length > 0 && (
        <section aria-labelledby="jornada" className="flex flex-col gap-3">
          <h2 id="jornada" className="font-heading text-lg font-bold">
            Jornada na organização
          </h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {jornada.map((j) => {
              const Icone = ICONE_MODULO[j.chave];
              return (
                <li key={j.chave}>
                  <Link href={j.href} className="block h-full">
                    <Cartao className="h-full flex-row gap-3 p-4 transition-shadow hover:shadow-hover">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-teal-soft text-teal-strong" aria-hidden>
                        <Icone className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{j.titulo}</span>
                        <span className="block text-xs text-muted-foreground">{j.texto}</span>
                      </span>
                    </Cartao>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {onboardings.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-bold">Onboarding</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {onboardings.map((o) => (
              <li key={o.id}>
                <Link href={`/onboarding/${o.id}`} className="font-medium text-teal-strong hover:underline">{o.modeloNome}</Link>{" "}
                · {o.status === "em_andamento" ? `em andamento (${o.tarefas.filter((t) => t.status !== "pendente").length}/${o.tarefas.length})` : o.status === "concluido" ? "concluído" : "cancelado"} · início {formatarData(o.inicio)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <FormPessoa pessoa={pessoa} equipes={equipes} gestores={gestores} somenteLeitura={!podeEditar} />
    </>
  );
}
