import type { Metadata } from "next";
import { exigirSuperadmin } from "@/lib/contexto";
import { alternarSuperadmin } from "@/lib/plataforma/actions";
import { formatarData } from "@/lib/formato";
import { Celula, Tabela } from "@/components/app/tabela";
import { BarraBusca, Paginacao, POR_PAGINA, paginaDe } from "@/components/app/lista";
import { BotaoAcao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Usuários — Administração" };

export default async function UsuariosPlataformaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { db, usuario: eu } = await exigirSuperadmin();
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const where = sp.q ? { OR: [{ nome: { contains: sp.q, mode: "insensitive" as const } }, { email: { contains: sp.q, mode: "insensitive" as const } }] } : {};
  const [total, usuarios] = await Promise.all([
    db.usuario.count({ where }),
    db.usuario.findMany({
      where,
      include: { associacoes: { include: { organizacao: { select: { nome: true } }, papel: { select: { nome: true } } } } },
      orderBy: { nome: "asc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
  ]);
  return (
    <>
      <h1 className="font-heading text-[28px] font-bold tracking-tight">Usuários</h1>
      <BarraBusca q={sp.q} placeholder="Nome ou e-mail" />
      <Tabela colunas={["Usuário", "Organizações e papéis", "Cadastro", "Superadmin"]} minWidth={820}>
        {usuarios.map((u) => (
          <tr key={u.id}>
            <Celula>
              {u.nome}
              <span className="block text-xs text-muted-foreground">{u.email}</span>
            </Celula>
            <Celula className="text-muted-foreground">
              {u.associacoes.length ? u.associacoes.map((a) => `${a.organizacao.nome} (${a.papel.nome}${a.status === "suspensa" ? ", suspenso" : ""})`).join("; ") : "—"}
            </Celula>
            <Celula className="tabular-nums text-muted-foreground">{formatarData(u.criadoEm)}</Celula>
            <Celula>
              {u.id === eu.id ? (
                "Você"
              ) : (
                <form action={alternarSuperadmin.bind(null, u.id)}>
                  <BotaoAcao variante={u.superadmin ? "perigo" : "outline"}>{u.superadmin ? "Remover" : "Conceder"}</BotaoAcao>
                </form>
              )}
            </Celula>
          </tr>
        ))}
      </Tabela>
      <Paginacao pagina={pagina} total={total} params={{ q: sp.q }} />
    </>
  );
}
