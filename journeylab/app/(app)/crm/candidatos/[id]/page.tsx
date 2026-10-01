import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FileText, Trash2, TriangleAlert, UserCheck } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { buscarDuplicidades, filtroCandidatos } from "@/lib/crm/consultas";
import { STATUS_CANDIDATURA, TIPO_INTERACAO } from "@/lib/crm/normalizar";
import {
  adicionarInteracao,
  alterarCandidatura,
  associarVaga,
  converterEmColaborador,
  enviarAnexo,
  removerAnexo,
} from "@/lib/crm/actions";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { FormCandidato } from "@/components/crm/form-candidato";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo, Selecao } from "@/components/admin/campos";
import { Selo } from "@/components/app/lista";
import { TelefoneWhatsapp } from "@/components/crm/whatsapp";

export const metadata: Metadata = { title: "Candidato" };

function Bloco({ titulo, children, id }: { titulo: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-heading text-lg font-bold">{titulo}</h2>
      {children}
    </section>
  );
}

export default async function CandidatoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, escopo, db } = await exigirModulo("crm");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  // Organização garantida pelo RLS; escopo do papel aplicado na consulta.
  const c = await db.candidato.findFirst({
    where: { AND: [{ id }, filtroCandidatos(ctx, escopo)] },
    include: {
      tags: { include: { tag: true } },
      anexos: { orderBy: { criadoEm: "desc" } },
      candidaturas: { include: { vaga: { select: { id: true, titulo: true, status: true } } }, orderBy: { criadoEm: "desc" } },
      interacoes: { orderBy: { criadoEm: "desc" }, take: 100 },
      colaborador: { select: { id: true, nome: true, status: true } },
    },
  });
  if (!c) notFound();

  const podeEditar = !!pode(ctx, "crm", "editar");
  const podeCriar = !!pode(ctx, "crm", "criar");
  const podeConverter = !!pode(ctx, "crm", "concluir") && pode(ctx, "cadastro", "criar") === "todos" && !c.colaborador;
  const [duplicados, vagasAbertas, colaboradoresLivres, equipes, gestores] = await Promise.all([
    buscarDuplicidades(db, c, c.id),
    podeEditar ? db.vaga.findMany({ where: { status: { in: ["aberta", "pausada"] }, candidaturas: { none: { candidatoId: c.id } } }, select: { id: true, titulo: true }, orderBy: { titulo: "asc" } }) : [],
    podeConverter ? db.colaborador.findMany({ where: { candidatoOrigemId: null }, select: { id: true, nome: true, email: true }, orderBy: { nome: "asc" } }) : [],
    podeConverter ? db.equipe.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : [],
    podeConverter ? db.colaborador.findMany({ where: { status: "ativo" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : [],
  ]);
  // Modelos de onboarding só entram se o módulo estiver ativo e o papel puder iniciar.
  // Onboarding contratado: a conversão cria o onboarding automaticamente (como no cadastro).
  const onboardingAtivo = podeConverter && ctx.modulos.has("onboarding");
  const modelosOnboarding = onboardingAtivo ? await db.modeloOnboarding.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : [];
  const mesmoEmail = colaboradoresLivres.find((p) => c.emailNorm && p.email === c.emailNorm);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/crm" className="text-sm text-muted-foreground hover:text-foreground">← Candidatos</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-bold">{c.nome}</h2>
          {c.tags.map((t) => (
            <span key={t.tagId} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{t.tag.nome}</span>
          ))}
        </div>
        {(c.email || c.telefone) && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {c.email && (
              <a href={`mailto:${c.email}`} className="text-muted-foreground hover:text-foreground hover:underline">
                {c.email}
              </a>
            )}
            {c.telefone && <TelefoneWhatsapp telefone={c.telefone} nome={c.nome} />}
          </p>
        )}
        {c.colaborador && (
          <p className="flex items-center gap-2 text-sm">
            <UserCheck className="size-4 text-success" aria-hidden />
            Convertido em colaborador:{" "}
            <Link href={`/colaboradores/${c.colaborador.id}`} className="font-medium text-teal-strong hover:underline">{c.colaborador.nome}</Link>
          </p>
        )}
      </div>

      {duplicados.length > 0 && (
        <div role="note" className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning" aria-hidden />
          <div>
            <p className="font-semibold">Possível duplicidade</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {duplicados.map((d) => (
                <li key={d.id}>
                  <Link href={`/crm/candidatos/${d.id}`} className="underline underline-offset-2">{d.nome}</Link> — {d.motivo}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-8">
          <Bloco titulo="Dados do candidato" id="dados">
            <FormCandidato c={c} tags={c.tags.map((t) => t.tag.nome)} somenteLeitura={!podeEditar} />
          </Bloco>

          <Bloco titulo="Vagas" id="vagas">
            {c.candidaturas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Não associado a nenhuma vaga.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {c.candidaturas.map((cd) => (
                  <li key={cd.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/pagina-carreiras/vagas/${cd.vaga.id}`} className="font-semibold hover:text-teal-strong">{cd.vaga.titulo}</Link>
                      <Selo tom={STATUS_CANDIDATURA[cd.status].tom}>{STATUS_CANDIDATURA[cd.status].nome}</Selo>
                    </div>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {cd.origem === "carreiras" ? "Candidatura pela Página de Carreiras" : "Associado internamente"} em {formatarData(cd.criadoEm)}
                      {cd.atualizadoEm.getTime() - cd.criadoEm.getTime() > 60_000 && cd.origem === "carreiras" && ` · última candidatura em ${formatarData(cd.atualizadoEm)}`}
                      {cd.anexoId && (
                        <>
                          {" · "}
                          <a href={`/crm/anexos/${cd.anexoId}`} className="font-medium text-teal-strong hover:underline">
                            currículo desta candidatura
                          </a>
                        </>
                      )}
                    </p>
                    {podeEditar ? (
                      <FormAcao action={alterarCandidatura} textoBotao="Atualizar situação">
                        <input type="hidden" name="id" value={cd.id} />
                        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                          <Selecao
                            nome="status"
                            rotulo="Situação"
                            defaultValue={cd.status}
                            opcoes={Object.entries(STATUS_CANDIDATURA).map(([valor, s]) => ({ valor, rotulo: s.nome }))}
                          />
                          <Campo nome="observacao" rotulo="Observação" defaultValue={cd.observacao ?? ""} />
                        </div>
                      </FormAcao>
                    ) : (
                      cd.observacao && <p className="text-sm text-muted-foreground">{cd.observacao}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {podeEditar && vagasAbertas.length > 0 && (
              <FormAcao action={associarVaga} textoBotao="Associar à vaga" className="rounded-lg border border-dashed border-border p-4">
                <input type="hidden" name="candidatoId" value={c.id} />
                <Selecao nome="vagaId" rotulo="Vaga aberta" opcoes={[{ valor: "", rotulo: "Selecione…" }, ...vagasAbertas.map((v) => ({ valor: v.id, rotulo: v.titulo }))]} />
              </FormAcao>
            )}
          </Bloco>

          {podeConverter && (
            <Bloco titulo="Converter em colaborador" id="converter">
              <p className="text-sm text-muted-foreground">
                Ação explícita: cria o cadastro de colaborador (ou vincula a um existente, evitando duplicidade),
                preservando todo o histórico do candidato.
                {modelosOnboarding.length > 0 && " Você pode iniciar o onboarding no mesmo passo."}
              </p>
              {mesmoEmail && (
                <p role="note" className="rounded-md bg-warning/10 px-3 py-2 text-sm">
                  Já existe um colaborador com o mesmo e-mail ({mesmoEmail.nome}). Prefira “Vincular a colaborador existente”.
                </p>
              )}
              <FormAcao action={converterEmColaborador} textoBotao="Converter em colaborador" className="rounded-lg border border-border bg-card p-4">
                <input type="hidden" name="candidatoId" value={c.id} />
                <div className="grid gap-3 md:grid-cols-2">
                  <Selecao
                    nome="modo"
                    rotulo="Como registrar"
                    defaultValue={mesmoEmail ? "vincular" : "novo"}
                    opcoes={[
                      { valor: "novo", rotulo: "Criar novo colaborador" },
                      { valor: "vincular", rotulo: "Vincular a colaborador existente" },
                    ]}
                  />
                  <Selecao
                    nome="colaboradorExistenteId"
                    rotulo="Colaborador existente (se vincular)"
                    defaultValue={mesmoEmail?.id ?? ""}
                    opcoes={[{ valor: "", rotulo: "—" }, ...colaboradoresLivres.map((p) => ({ valor: p.id, rotulo: p.nome }))]}
                  />
                  <Campo nome="cargo" rotulo="Cargo" />
                  <Campo nome="dataAdmissao" rotulo="Data de admissão" type="date" required />
                  <Selecao nome="equipeId" rotulo="Equipe" opcoes={[{ valor: "", rotulo: "Sem equipe" }, ...equipes.map((e) => ({ valor: e.id, rotulo: e.nome }))]} />
                  <Selecao nome="gestorId" rotulo="Gestor direto" opcoes={[{ valor: "", rotulo: "Gestor da equipe" }, ...gestores.map((g) => ({ valor: g.id, rotulo: g.nome }))]} />
                  <Selecao
                    nome="candidaturaId"
                    rotulo="Vaga de contratação"
                    opcoes={[{ valor: "", rotulo: "Não informar" }, ...c.candidaturas.map((cd) => ({ valor: cd.id, rotulo: cd.vaga.titulo }))]}
                  />
                  {onboardingAtivo && (
                    <Selecao
                      nome="modeloOnboardingId"
                      rotulo="Onboarding"
                      ajuda="Criado automaticamente com a data de admissão."
                      opcoes={[
                        { valor: "auto", rotulo: "Criar com o template aplicável (área ou padrão)" },
                        ...modelosOnboarding.map((m) => ({ valor: m.id, rotulo: `Criar com: ${m.nome}` })),
                        { valor: "nao", rotulo: "Não criar agora" },
                      ]}
                    />
                  )}
                </div>
              </FormAcao>
            </Bloco>
          )}
        </div>

        <aside className="flex flex-col gap-8">
          <Bloco titulo="Currículo e anexos" id="anexos">
            {c.anexos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum arquivo enviado.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {c.anexos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                    <a href={`/crm/anexos/${a.id}`} className="flex min-w-0 items-center gap-2 hover:text-teal-strong">
                      <FileText className="size-4 shrink-0 text-teal-strong" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate">{a.nomeArquivo}</span>
                        <span className="block text-xs text-muted-foreground">
                          {a.tipo === "curriculo" ? "Currículo" : "Anexo"} · {Math.ceil(a.tamanho / 1024)} KB · {formatarData(a.criadoEm)}
                        </span>
                      </span>
                    </a>
                    {podeEditar && (
                      <form action={removerAnexo.bind(null, a.id)}>
                        <button type="submit" aria-label={`Remover ${a.nomeArquivo}`} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {podeEditar && (
              <FormAcao action={enviarAnexo} textoBotao="Enviar arquivo" limparAoConcluir className="rounded-lg border border-dashed border-border p-4">
                <input type="hidden" name="candidatoId" value={c.id} />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="arquivo" className="text-[13px] font-semibold text-foreground/85">Arquivo (PDF, DOC ou DOCX, até 10 MB)</label>
                  <input id="arquivo" name="arquivo" type="file" accept=".pdf,.doc,.docx" required className="text-sm" />
                </div>
                <Selecao nome="tipo" rotulo="Tipo" opcoes={[{ valor: "curriculo", rotulo: "Currículo" }, { valor: "outro", rotulo: "Outro anexo" }]} />
              </FormAcao>
            )}
          </Bloco>

          <Bloco titulo="Histórico" id="historico">
            {podeCriar && (
              <FormAcao action={adicionarInteracao} textoBotao="Registrar" limparAoConcluir>
                <input type="hidden" name="candidatoId" value={c.id} />
                <Selecao
                  nome="tipo"
                  rotulo="Tipo"
                  opcoes={[
                    { valor: "nota", rotulo: "Nota" },
                    { valor: "ligacao", rotulo: "Ligação" },
                    { valor: "email", rotulo: "E-mail" },
                    { valor: "entrevista", rotulo: "Entrevista" },
                  ]}
                />
                <Area nome="texto" rotulo="Registro" rows={3} required />
              </FormAcao>
            )}
            <ol className="flex flex-col gap-3">
              {c.interacoes.map((i) => (
                <li key={i.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                  <p className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground/80">{TIPO_INTERACAO[i.tipo]}</span>
                    <span>{i.autorNome} · {formatarDataHora(i.criadoEm.toISOString())}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-line">{i.texto}</p>
                </li>
              ))}
            </ol>
          </Bloco>
          <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
            Cadastrado por {c.criadoPor} em {formatarData(c.criadoEm)}.
          </div>
        </aside>
      </div>
    </>
  );
}
