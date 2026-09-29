import type { Metadata } from "next";
import { exigirSuperadmin } from "@/lib/contexto";
import { formatarDataHora } from "@/lib/formato";
import { Celula, Tabela } from "@/components/app/tabela";
import { EstadoVazio, Paginacao, POR_PAGINA, paginaDe } from "@/components/app/lista";

export const metadata: Metadata = { title: "Auditoria — Administração" };

export default async function AuditoriaPlataformaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { db } = await exigirSuperadmin();
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const [total, registros, orgs] = await Promise.all([
    db.auditoria.count(),
    db.auditoria.findMany({ orderBy: { criadoEm: "desc" }, skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
    db.organizacao.findMany({ select: { id: true, nome: true } }),
  ]);
  const nomeOrg = new Map(orgs.map((o) => [o.id, o.nome]));
  return (
    <>
      <h1 className="font-heading text-[28px] font-bold tracking-tight">Auditoria</h1>
      {registros.length === 0 ? (
        <EstadoVazio titulo="Sem registros" descricao="Ações administrativas aparecem aqui." />
      ) : (
        <Tabela colunas={["Quando", "Organização", "Quem", "Ação", "Registro"]} minWidth={820}>
          {registros.map((r) => (
            <tr key={r.id}>
              <Celula className="tabular-nums whitespace-nowrap">{formatarDataHora(r.criadoEm.toISOString())}</Celula>
              <Celula className="text-muted-foreground">{r.tenantId ? nomeOrg.get(r.tenantId) ?? r.tenantId : "Plataforma"}</Celula>
              <Celula>{r.usuarioNome}</Celula>
              <Celula className="font-mono text-[12.5px]">{r.acao}</Celula>
              <Celula className="text-muted-foreground">{r.entidade}</Celula>
            </tr>
          ))}
        </Tabela>
      )}
      <Paginacao pagina={pagina} total={total} params={{}} />
    </>
  );
}
