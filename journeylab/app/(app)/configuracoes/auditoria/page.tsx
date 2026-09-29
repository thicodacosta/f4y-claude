import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { dbTenant } from "@/lib/db";
import { exigirContexto, pode } from "@/lib/contexto";
import { formatarDataHora } from "@/lib/formato";
import { Celula, Tabela } from "@/components/app/tabela";
import { EstadoVazio, Paginacao, POR_PAGINA, paginaDe } from "@/components/app/lista";

export const metadata: Metadata = { title: "Auditoria" };

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await exigirContexto();
  if (!pode(ctx, "organizacao", "administrar") && !ctx.suporte) redirect("/configuracoes");
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const [total, registros] = await Promise.all([
    db.auditoria.count(),
    db.auditoria.findMany({ orderBy: { criadoEm: "desc" }, skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
  ]);
  return (
    <>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Registro imutável das ações relevantes na organização, incluindo acessos de suporte do JourneyLab.
      </p>
      {registros.length === 0 ? (
        <EstadoVazio titulo="Nenhuma ação registrada" descricao="As ações administrativas aparecem aqui." />
      ) : (
        <Tabela colunas={["Quando", "Quem", "Ação", "Registro"]} minWidth={640}>
          {registros.map((r) => (
            <tr key={r.id}>
              <Celula className="tabular-nums whitespace-nowrap">{formatarDataHora(r.criadoEm.toISOString())}</Celula>
              <Celula>
                {r.usuarioNome}
                {r.suporte && <span className="block text-xs text-warning-foreground dark:text-warning">suporte JourneyLab</span>}
              </Celula>
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
