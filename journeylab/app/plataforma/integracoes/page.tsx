import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { exigirSuperadmin } from "@/lib/contexto";
import { formatarDataHora } from "@/lib/formato";
import { valorPermitido } from "@/lib/validacao";
import { TIPO_EVENTO, type TipoEvento } from "@/lib/integracoes/processar";
import { aplicarEvento, ignorarEvento, reprocessarEvento } from "@/lib/plataforma/actions";
import { Celula, Tabela } from "@/components/app/tabela";
import { EstadoVazio, FiltroSelect, Paginacao, POR_PAGINA, paginaDe, Selo } from "@/components/app/lista";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Integrações — Administração" };

const SITUACAO = { recebido: "Aguardando revisão", processado: "Processado", ignorado: "Ignorado", erro: "Erro" } as const;

export default async function IntegracoesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { db } = await exigirSuperadmin();
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const status = valorPermitido(sp.status, SITUACAO);
  const where = status ? { status } : {};
  const [total, eventos, pendentes, erros, orgs, produtos] = await Promise.all([
    db.eventoIntegracao.count({ where }),
    db.eventoIntegracao.findMany({ where, orderBy: { recebidoEm: "desc" }, skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
    db.eventoIntegracao.count({ where: { status: "recebido" } }),
    db.eventoIntegracao.count({ where: { status: "erro" } }),
    db.organizacao.findMany({ where: { ativa: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.produtoExterno.findMany({ select: { canal: true, idExterno: true, descricao: true, modulos: true } }),
  ]);
  const nomeOrg = (id: string | null) => orgs.find((o) => o.id === id)?.nome;
  const automatica = process.env.INTEGRACAO_ATIVACAO_AUTOMATICA === "true";

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-[28px] font-bold tracking-tight">Integrações</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Eventos de compra recebidos em <span className="font-mono text-[13px]">/api/webhooks/kiwify</span> e <span className="font-mono text-[13px]">/api/webhooks/site</span>, gravados antes de
          qualquer processamento. Ativação automática: <strong className="text-foreground">{automatica ? "ligada" : "desligada (revisão manual)"}</strong>.{" "}
          {pendentes > 0 && <strong className="text-foreground">{pendentes} aguardando revisão.</strong>} {erros > 0 && <strong className="text-destructive">{erros} com erro.</strong>}
        </p>
      </div>
      <form className="flex items-end gap-2">
        <FiltroSelect nome="status" rotulo="Situação" valor={status} opcoes={Object.entries(SITUACAO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
        <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Filtrar
        </button>
      </form>
      {eventos.length === 0 ? (
        <EstadoVazio titulo="Nenhum evento" descricao="Configure o webhook na Kiwify (ou no site) apontando para os endereços acima." />
      ) : (
        <Tabela colunas={["Recebido", "Evento", "Organização", "Situação", "Ações"]} minWidth={1040}>
          {eventos.map((e) => {
            const produto = produtos.find((p) => p.canal === e.canal && p.idExterno === e.produtoIdExterno);
            return (
              <tr key={e.id}>
                <Celula className="align-top tabular-nums whitespace-nowrap">
                  {formatarDataHora(e.recebidoEm.toISOString())}
                  <span className="block text-xs text-muted-foreground">
                    {e.canal} · token {e.tokenConferido === null ? "—" : e.tokenConferido ? "conferido" : "ausente"}
                  </span>
                </Celula>
                <Celula className="align-top">
                  <span className="font-medium">{e.tipo ? TIPO_EVENTO[e.tipo as TipoEvento] : "Não interpretado"}</span>
                  <span className="block text-xs text-muted-foreground">
                    Pedido {e.pedidoId ?? "—"} · {produto ? `${produto.descricao} (${produto.modulos.join(", ")})` : `produto ${e.produtoIdExterno ?? "—"} não cadastrado`}
                  </span>
                  <span className="block text-xs text-muted-foreground">{[e.compradorEmail, e.compradorDocumento].filter(Boolean).join(" · ") || "Comprador não informado"}</span>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-teal-strong">Conteúdo bruto</summary>
                    <pre className="mt-2 max-h-60 max-w-md overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] whitespace-pre-wrap">
                      {JSON.stringify({ consulta: e.consulta, cabecalhos: e.cabecalhos, corpo: e.corpo ?? e.corpoBruto }, null, 2)}
                    </pre>
                  </details>
                </Celula>
                <Celula className="align-top">{nomeOrg(e.organizacaoId) ?? <span className="text-muted-foreground">Não identificada</span>}</Celula>
                <Celula className="max-w-xs align-top">
                  <Selo tom={e.status === "erro" ? "perigo" : e.status === "processado" ? "sucesso" : e.status === "recebido" ? "alerta" : "neutro"}>{SITUACAO[e.status]}</Selo>
                  {e.erro && <span className="mt-1 block text-xs text-muted-foreground">{e.erro}</span>}
                  {e.aplicadoPor && e.status === "processado" && <span className="mt-1 block text-xs text-muted-foreground">Por {e.aplicadoPor}</span>}
                </Celula>
                <Celula className="w-72 align-top">
                  {(e.status === "recebido" || e.status === "erro") && (
                    <div className="flex flex-col gap-2">
                      {e.tipo && e.tipo !== "outro" && (
                        <FormAcao action={aplicarEvento} textoBotao="Aplicar">
                          <input type="hidden" name="eventoId" value={e.id} />
                          <Selecao
                            nome="organizacaoId"
                            idCampo={`org-${e.id}`}
                            rotulo="Organização"
                            defaultValue={e.organizacaoId ?? ""}
                            opcoes={[{ valor: "", rotulo: "Selecione…" }, ...orgs.map((o) => ({ valor: o.id, rotulo: o.nome }))]}
                          />
                        </FormAcao>
                      )}
                      <form action={reprocessarEvento.bind(null, e.id)}>
                        <button type="submit" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <RefreshCw className="size-3.5" aria-hidden /> Reinterpretar
                        </button>
                      </form>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ignorar…</summary>
                        <FormAcao action={ignorarEvento} textoBotao="Ignorar evento" variante="outline" className="mt-2">
                          <input type="hidden" name="eventoId" value={e.id} />
                          <Campo nome="motivo" idCampo={`mot-${e.id}`} rotulo="Motivo" required />
                        </FormAcao>
                      </details>
                    </div>
                  )}
                </Celula>
              </tr>
            );
          })}
        </Tabela>
      )}
      <Paginacao pagina={pagina} total={total} params={{ status: sp.status }} />
    </>
  );
}
