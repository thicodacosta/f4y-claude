import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { exigirSuperadmin } from "@/lib/contexto";
import { alterarModulo, convidarAdminOrganizacao, editarOrganizacao, iniciarSuporte } from "@/lib/plataforma/actions";
import { entitlementLibera } from "@/lib/entitlements";
import { MODULOS, NOME_MODULO, STATUS_ENTITLEMENT, type Modulo } from "@/lib/permissoes";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { Celula, Tabela } from "@/components/app/tabela";
import { Selo } from "@/components/app/lista";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo, Interruptor, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Organização — Administração" };

const dataInput = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export default async function OrganizacaoPlataformaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await exigirSuperadmin();
  const [org, historico, suportes] = await Promise.all([
    db.organizacao.findUnique({
      where: { id },
      include: {
        entitlements: true,
        associacoes: { include: { usuario: { select: { nome: true, email: true } }, papel: { select: { nome: true } } }, orderBy: { criadoEm: "asc" } },
      },
    }),
    db.historicoEntitlement.findMany({ where: { tenantId: id }, orderBy: { criadoEm: "desc" }, take: 30 }),
    db.acessoSuporte.findMany({ where: { tenantId: id }, orderBy: { inicio: "desc" }, take: 10 }),
  ]);
  if (!org) notFound();

  return (
    <>
      <div>
        <Link href="/plataforma" className="text-sm text-muted-foreground hover:text-foreground">← Organizações</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold">{org.nome}</h1>
          <Selo tom={org.ativa ? "sucesso" : "neutro"}>{org.ativa ? "Ativa" : "Inativa"}</Selo>
        </div>
      </div>

      <section aria-labelledby="modulos" className="flex flex-col gap-3">
        <h2 id="modulos" className="font-heading text-lg font-bold">Módulos</h2>
        <p className="text-sm text-muted-foreground">
          Acesso liberado quando a situação é “Ativo” ou “Em teste” e a data atual está no período. Suspender ou encerrar
          não apaga dados. Toda mudança exige motivo e fica no histórico.
        </p>
        <ul className="grid gap-3 lg:grid-cols-2">
          {MODULOS.map((m) => {
            const e = org.entitlements.find((x) => x.modulo === m.chave);
            const liberado = e ? entitlementLibera(e) : false;
            return (
              <li key={m.chave} className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-semibold">{m.nome}</p>
                  <Selo tom={liberado ? "sucesso" : "neutro"}>
                    {e ? STATUS_ENTITLEMENT[e.status].nome : "Não contratado"}
                    {e?.fim ? ` · até ${formatarData(e.fim)}` : ""}
                  </Selo>
                </div>
                <FormAcao action={alterarModulo} textoBotao="Aplicar">
                  <input type="hidden" name="tenantId" value={org.id} />
                  <input type="hidden" name="modulo" value={m.chave} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Selecao
                      nome="status"
                      rotulo="Situação"
                      defaultValue={e?.status ?? "ativo"}
                      opcoes={Object.entries(STATUS_ENTITLEMENT).map(([valor, s]) => ({ valor, rotulo: s.nome }))}
                    />
                    <Campo nome="inicio" rotulo="Início" type="date" defaultValue={dataInput(e?.inicio ?? new Date())} />
                    <Campo nome="fim" rotulo="Expira em" type="date" defaultValue={dataInput(e?.fim)} ajuda="Vazio = sem prazo." />
                  </div>
                  <Campo nome="motivo" rotulo="Motivo" required placeholder="Ex.: contrato 2026/031, período de teste, inadimplência" />
                </FormAcao>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-bold">Histórico de módulos</h2>
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteração ainda.</p>
        ) : (
          <Tabela colunas={["Quando", "Módulo", "De → Para", "Período", "Origem", "Responsável", "Motivo"]} minWidth={980}>
            {historico.map((h) => (
              <tr key={h.id}>
                <Celula className="tabular-nums whitespace-nowrap">{formatarDataHora(h.criadoEm.toISOString())}</Celula>
                <Celula>{NOME_MODULO[h.modulo as Modulo]}</Celula>
                <Celula>
                  {h.statusAnterior ? STATUS_ENTITLEMENT[h.statusAnterior].nome : "—"} → {STATUS_ENTITLEMENT[h.statusNovo].nome}
                </Celula>
                <Celula className="tabular-nums text-muted-foreground">
                  {formatarData(h.inicio)} → {h.fim ? formatarData(h.fim) : "sem prazo"}
                </Celula>
                <Celula className="text-muted-foreground">{h.origem}</Celula>
                <Celula className="text-muted-foreground">{h.responsavelNome}</Celula>
                <Celula className="text-muted-foreground">{h.motivo ?? "—"}</Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">Usuários ({org.associacoes.length})</h2>
        <Tabela colunas={["Nome", "E-mail", "Papel", "Situação"]} minWidth={560}>
          {org.associacoes.map((a) => (
            <tr key={a.id}>
              <Celula>{a.usuario.nome}</Celula>
              <Celula className="text-muted-foreground">{a.usuario.email}</Celula>
              <Celula className="text-muted-foreground">{a.papel.nome}</Celula>
              <Celula>{a.status === "ativa" ? "Ativo" : "Suspenso"}</Celula>
            </tr>
          ))}
        </Tabela>
        <details className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Convidar administrador da organização</summary>
          <div className="mt-3">
            <FormAcao action={convidarAdminOrganizacao} textoBotao="Enviar convite" limparAoConcluir>
              <input type="hidden" name="tenantId" value={org.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <Campo nome="email" rotulo="E-mail" type="email" required />
                <Campo nome="nome" rotulo="Nome" />
              </div>
            </FormAcao>
          </div>
        </details>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Dados da organização</h2>
          <FormAcao action={editarOrganizacao} textoBotao="Salvar">
            <input type="hidden" name="id" value={org.id} />
            <Campo nome="nome" rotulo="Nome" defaultValue={org.nome} required />
            <Campo nome="documento" rotulo="CNPJ" defaultValue={org.documento ?? ""} />
            <Campo
              nome="minimoRecorte"
              rotulo="Mínimo de respondentes para recortes (Pulse/NR-1)"
              type="number"
              min={3}
              max={50}
              defaultValue={org.minimoRecorte}
            />
            <Area
              nome="identificadores"
              rotulo="Identificadores para compras externas"
              ajuda="Um por linha: e-mail do comprador, domínio (@empresa.com.br) ou CNPJ. Usados para ligar compras Kiwify/site a esta organização."
              defaultValue={org.identificadoresExternos.join("\n")}
              rows={2}
            />
            <Interruptor nome="ativa" rotulo="Organização ativa" marcado={org.ativa} ajuda="Inativa: ninguém da organização acessa; dados preservados." />
          </FormAcao>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Acesso de suporte</h2>
          <p className="text-sm text-muted-foreground">
            Somente leitura, com prazo e motivo; registrado na auditoria da organização. Não dá acesso a respostas
            individuais de Pulse ou NR-1.
          </p>
          <FormAcao action={iniciarSuporte} textoBotao="Iniciar acesso de suporte">
            <input type="hidden" name="tenantId" value={org.id} />
            <Area nome="motivo" rotulo="Motivo" required rows={2} placeholder="Ex.: chamado #123 — cliente relata erro no cadastro de equipes" />
            <Selecao
              nome="horas"
              rotulo="Duração"
              defaultValue="1"
              opcoes={[1, 2, 4, 8].map((h) => ({ valor: String(h), rotulo: `${h} hora${h > 1 ? "s" : ""}` }))}
            />
          </FormAcao>
          {suportes.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {suportes.map((s) => (
                <li key={s.id}>
                  {formatarDataHora(s.inicio.toISOString())} · {s.superadminNome} · {s.motivo}
                  {s.encerradoEm ? " · encerrado" : s.expiraEm < new Date() ? " · expirado" : " · em andamento"}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
