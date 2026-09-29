import Link from "next/link";
import type { Metadata } from "next";
import { exigirSuperadmin } from "@/lib/contexto";
import { criarOrganizacao } from "@/lib/plataforma/actions";
import { entitlementLibera } from "@/lib/entitlements";
import { NOME_MODULO, type Modulo } from "@/lib/permissoes";
import { Celula, Tabela } from "@/components/app/tabela";
import { BarraBusca, EstadoVazio, Paginacao, POR_PAGINA, paginaDe, Selo } from "@/components/app/lista";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Organizações — Administração" };

export default async function PlataformaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { db } = await exigirSuperadmin();
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const where = sp.q ? { OR: [{ nome: { contains: sp.q, mode: "insensitive" as const } }, { documento: { contains: sp.q } }] } : {};
  const [total, orgs] = await Promise.all([
    db.organizacao.count({ where }),
    db.organizacao.findMany({
      where,
      include: { entitlements: true, _count: { select: { associacoes: { where: { status: "ativa" } } } } },
      orderBy: { nome: "asc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
  ]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-[28px] font-bold tracking-tight">Organizações</h1>
        <p className="text-sm text-muted-foreground">Clientes JourneyLab, módulos contratados e usuários.</p>
      </div>
      <BarraBusca q={sp.q} placeholder="Nome ou documento" />
      {orgs.length === 0 ? (
        <EstadoVazio titulo="Nenhuma organização" descricao="Cadastre o primeiro cliente abaixo." />
      ) : (
        <Tabela colunas={["Organização", "Módulos liberados", "Usuários", "Situação"]} minWidth={760}>
          {orgs.map((o) => {
            const liberados = o.entitlements.filter((e) => entitlementLibera(e));
            return (
              <tr key={o.id}>
                <Celula>
                  <Link href={`/plataforma/organizacoes/${o.id}`} className="font-medium hover:text-teal-strong">{o.nome}</Link>
                  {o.documento && <span className="block text-xs text-muted-foreground">{o.documento}</span>}
                </Celula>
                <Celula className="text-muted-foreground">
                  {liberados.length ? liberados.map((e) => NOME_MODULO[e.modulo as Modulo]).join(", ") : "Nenhum"}
                </Celula>
                <Celula className="tabular-nums">{o._count.associacoes}</Celula>
                <Celula>
                  <Selo tom={o.ativa ? "sucesso" : "neutro"}>{o.ativa ? "Ativa" : "Inativa"}</Selo>
                </Celula>
              </tr>
            );
          })}
        </Tabela>
      )}
      <Paginacao pagina={pagina} total={total} params={{ q: sp.q }} />
      <details className="rounded-lg border border-border bg-card p-5">
        <summary className="cursor-pointer font-semibold">Nova organização</summary>
        <div className="mt-4">
          <FormAcao action={criarOrganizacao} textoBotao="Criar organização e convidar administrador">
            <div className="grid gap-3 md:grid-cols-2">
              <Campo nome="nome" rotulo="Nome da organização" required />
              <Campo nome="documento" rotulo="CNPJ (opcional)" />
              <Campo nome="adminNome" rotulo="Nome do administrador" />
              <Campo nome="adminEmail" rotulo="E-mail do administrador" type="email" required />
              <Area
                nome="identificadores"
                rotulo="Identificadores para compras externas (opcional)"
                rows={2}
                ajuda="E-mails ou documentos usados na Kiwify/site, um por linha — associam compras a esta organização."
                className="md:col-span-2"
              />
            </div>
          </FormAcao>
          <p className="mt-2 text-xs text-muted-foreground">Os papéis padrão são criados automaticamente. Nenhum módulo é ativado por padrão.</p>
        </div>
      </details>
    </>
  );
}
