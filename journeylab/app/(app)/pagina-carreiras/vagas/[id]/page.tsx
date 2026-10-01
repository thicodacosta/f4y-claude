import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { filtroVagas } from "@/lib/crm/consultas";
import { STATUS_CANDIDATURA } from "@/lib/crm/normalizar";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { emailValido } from "@/lib/email";
import { caminhoVagaPublica, chaveModalidade, NOTIFICACAO, situacaoPublica } from "@/lib/carreiras/regras";
import { EstadoVazio, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { Cartao, CabecalhoCartao } from "@/components/app/painel";
import { FormVagaCarreiras } from "@/components/carreiras/form-vaga";
import { AssumirNotificacoes, BotaoVaga, CopiarLink, PublicarVaga, ReenviarAviso } from "@/components/carreiras/acoes";
import { TelefoneWhatsapp } from "@/components/crm/whatsapp";

export const metadata: Metadata = { title: "Vaga · Página de Carreiras" };

export default async function VagaCarreiras({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, escopo, db } = await exigirModulo("crm");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const vaga = await db.vaga.findFirst({
    where: { AND: [{ id }, filtroVagas(ctx, escopo)] },
    include: {
      candidaturas: {
        include: { candidato: { select: { id: true, nome: true, email: true, telefone: true } }, anexo: { select: { id: true, nomeArquivo: true } } },
        orderBy: { atualizadoEm: "desc" },
      },
    },
  });
  if (!vaga) notFound();
  const [equipes, gestores, org] = await Promise.all([
    db.equipe.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.colaborador.findMany({ where: { status: "ativo" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.organizacao.findUnique({ where: { id: ctx.org.id }, select: { slug: true } }),
  ]);
  const podeEditar = !!pode(ctx, "crm", "editar") && !ctx.suporte;
  const s = situacaoPublica(vaga);
  const encerrada = vaga.status === "fechada" || vaga.status === "cancelada";
  const link = caminhoVagaPublica(org?.slug ?? "", vaga.slug);
  const emailOk = vaga.emailNotificacao && emailValido(vaga.emailNotificacao) && vaga.criadoPorUsuarioId ? vaga.emailNotificacao : null;
  const daPagina = vaga.candidaturas.filter((c) => c.origem === "carreiras").length;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/pagina-carreiras" className="text-sm text-muted-foreground hover:text-foreground">
          ← Página de Carreiras
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-bold">{vaga.titulo}</h2>
          <Selo tom={s.tom}>{s.nome}</Selo>
        </div>
        <p className="text-sm text-muted-foreground">
          Criada por {vaga.criadoPor} em {formatarData(vaga.abertaEm)}
          {vaga.publicadaEm && ` · publicada em ${formatarData(vaga.publicadaEm)}`}
          {vaga.fechadaEm && ` · encerrada em ${formatarData(vaga.fechadaEm)}`}
        </p>
        <p className="text-sm">
          Avisos de candidatura: <strong>{vaga.emailNotificacao ?? "sem e-mail configurado"}</strong>
          {vaga.emailConfirmadoEm ? <span className="text-muted-foreground"> · conferido em {formatarDataHora(vaga.emailConfirmadoEm.toISOString())}</span> : <span className="text-muted-foreground"> · ainda não conferido</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {s.chave === "publicada" && (
            <>
              <CopiarLink caminho={link} rotulo="Copiar link da vaga" />
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
                <ExternalLink className="size-4" aria-hidden /> Ver página pública
              </a>
            </>
          )}
          {podeEditar && vaga.publicada && <BotaoVaga acao="despublicar" id={vaga.id} />}
          {podeEditar && !encerrada && <BotaoVaga acao="encerrar" id={vaga.id} />}
          {podeEditar && encerrada && <BotaoVaga acao="reabrir" id={vaga.id} />}
          {podeEditar && emailOk && vaga.criadoPorUsuarioId !== ctx.usuario.id && <AssumirNotificacoes id={vaga.id} />}
        </div>
        {podeEditar && !vaga.publicada && !encerrada && (
          <div className="max-w-2xl">
            <PublicarVaga id={vaga.id} email={emailOk} />
          </div>
        )}
      </div>

      <Cartao aria-labelledby="candidaturas">
        <CabecalhoCartao id="candidaturas" titulo={`Candidaturas (${vaga.candidaturas.length})`} descricao={`${daPagina} pela Página de Carreiras · cada candidato também está no CRM de Candidatos.`} />
        <div className="px-5 pb-5">
          {vaga.candidaturas.length === 0 ? (
            <EstadoVazio titulo="Nenhuma candidatura" descricao="Quando alguém se candidatar pela página pública, aparece aqui e no CRM." />
          ) : (
            <Tabela colunas={["Candidato", "Contato", "Data", "Currículo", "Situação", "Aviso ao criador"]} minWidth={920}>
              {vaga.candidaturas.map((c) => (
                <tr key={c.id}>
                  <Celula>
                    <Link href={`/crm/candidatos/${c.candidato.id}`} className="font-medium hover:text-teal-strong">
                      {c.candidato.nome}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{c.origem === "carreiras" ? "Página de Carreiras" : "Associado no CRM"}</span>
                  </Celula>
                  <Celula className="text-xs">
                    {c.candidato.email ?? "—"}
                    <span className="block">
                      <TelefoneWhatsapp telefone={c.candidato.telefone} nome={c.candidato.nome} />
                    </span>
                  </Celula>
                  <Celula className="text-xs tabular-nums text-muted-foreground">
                    {formatarDataHora(c.criadoEm.toISOString())}
                    {c.atualizadoEm.getTime() - c.criadoEm.getTime() > 60_000 && c.origem === "carreiras" && <span className="block">reenvio {formatarDataHora(c.atualizadoEm.toISOString())}</span>}
                  </Celula>
                  <Celula className="text-xs">
                    {c.anexo ? (
                      <a href={`/crm/anexos/${c.anexo.id}`} className="font-medium text-teal-strong hover:underline">
                        {c.anexo.nomeArquivo}
                      </a>
                    ) : (
                      "—"
                    )}
                  </Celula>
                  <Celula>
                    <Selo tom={STATUS_CANDIDATURA[c.status].tom}>{STATUS_CANDIDATURA[c.status].nome}</Selo>
                  </Celula>
                  <Celula className="text-xs">
                    {c.notificacaoStatus ? (
                      <>
                        <Selo tom={NOTIFICACAO[c.notificacaoStatus as keyof typeof NOTIFICACAO]?.tom ?? "neutro"}>{NOTIFICACAO[c.notificacaoStatus as keyof typeof NOTIFICACAO]?.nome ?? c.notificacaoStatus}</Selo>
                        {c.notificacaoErro && <span className="mt-1 block text-destructive">{c.notificacaoErro}</span>}
                        {c.notificacaoEm && <span className="block text-muted-foreground">{formatarDataHora(c.notificacaoEm.toISOString())} · {c.notificacaoTentativas} tentativa(s)</span>}
                        {podeEditar && c.notificacaoStatus !== "enviado" && <ReenviarAviso id={c.id} />}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Celula>
                </tr>
              ))}
            </Tabela>
          )}
        </div>
      </Cartao>

      <Cartao aria-labelledby="dados" className="p-5">
        <h3 id="dados" className="mb-3 font-heading text-base font-bold">
          Dados da vaga
        </h3>
        <FormVagaCarreiras
          equipes={equipes}
          gestores={gestores}
          somenteLeitura={!podeEditar}
          inicial={{
            id: vaga.id,
            titulo: vaga.titulo,
            descricao: vaga.descricao ?? "",
            requisitos: vaga.requisitos ?? "",
            local: vaga.local ?? "",
            modelo: chaveModalidade(vaga.modelo),
            tipoContratacao: vaga.tipoContratacao ?? "",
            equipeId: vaga.equipeId ?? "",
            gestorId: vaga.gestorId ?? "",
          }}
        />
      </Cartao>
    </>
  );
}
