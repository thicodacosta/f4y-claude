import type { Metadata } from "next";
import { dbTenant } from "@/lib/db";
import { exigirContexto, pode } from "@/lib/contexto";
import { alterarAssociacao, convidarUsuario } from "@/lib/organizacao/actions";
import { formatarData } from "@/lib/formato";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo, Selecao } from "@/components/admin/campos";
import { BarraBusca, Paginacao, POR_PAGINA, paginaDe, Selo } from "@/components/app/lista";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await exigirContexto();
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const where = sp.q
    ? { usuario: { OR: [{ nome: { contains: sp.q, mode: "insensitive" as const } }, { email: { contains: sp.q, mode: "insensitive" as const } }] } }
    : {};
  const [total, associacoes, papeis, pessoas, convites] = await Promise.all([
    db.associacao.count({ where: { tenantId: ctx.org.id, ...where } }),
    db.associacao.findMany({
      where: { tenantId: ctx.org.id, ...where },
      include: { usuario: { select: { nome: true, email: true } }, papel: { select: { nome: true } }, colaborador: { select: { nome: true } } },
      orderBy: { criadoEm: "asc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    db.papel.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.colaborador.findMany({ where: { status: { not: "desligado" } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.convite.findMany({ orderBy: { criadoEm: "desc" }, take: 5 }),
  ]);
  const podeEditar = !!pode(ctx, "organizacao", "editar");
  const podeConvidar = !!pode(ctx, "organizacao", "criar");
  const opcoesPapel = papeis.map((p) => ({ valor: p.id, rotulo: p.nome }));
  const opcoesPessoa = [{ valor: "", rotulo: "Não vincular" }, ...pessoas.map((p) => ({ valor: p.id, rotulo: p.nome }))];

  return (
    <>
      {podeConvidar && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 font-heading text-lg font-bold">Convidar usuário</h2>
          <FormAcao action={convidarUsuario} textoBotao="Enviar convite" limparAoConcluir>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Campo nome="email" rotulo="E-mail" type="email" required />
              <Campo nome="nome" rotulo="Nome" />
              <Selecao nome="papelId" rotulo="Papel" opcoes={opcoesPapel} required />
              <Selecao nome="colaboradorId" rotulo="Pessoa do cadastro" opcoes={opcoesPessoa} ajuda="Necessário para escopos “equipe” e “próprio”." />
            </div>
          </FormAcao>
        </section>
      )}

      <BarraBusca q={sp.q} placeholder="Nome ou e-mail" />

      <ul className="flex flex-col gap-3">
        {associacoes.map((a) => (
          <li key={a.id} className="rounded-lg border border-border bg-card">
            <details>
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="font-semibold">{a.usuario.nome}</span>
                  <span className="block text-xs text-muted-foreground">{a.usuario.email}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {a.papel.nome}
                  {a.colaborador && <span>· {a.colaborador.nome}</span>}
                  <Selo tom={a.status === "ativa" ? "sucesso" : "neutro"}>{a.status === "ativa" ? "Ativo" : "Suspenso"}</Selo>
                </span>
              </summary>
              {podeEditar && (
                <div className="border-t border-border p-4">
                  <FormAcao action={alterarAssociacao} textoBotao="Salvar acesso">
                    <input type="hidden" name="id" value={a.id} />
                    <div className="grid gap-3 md:grid-cols-3">
                      <Selecao nome="papelId" rotulo="Papel" defaultValue={a.papelId} opcoes={opcoesPapel} />
                      <Selecao nome="colaboradorId" rotulo="Pessoa do cadastro" defaultValue={a.colaboradorId ?? ""} opcoes={opcoesPessoa} />
                      <Selecao
                        nome="status"
                        rotulo="Situação"
                        defaultValue={a.status}
                        opcoes={[
                          { valor: "ativa", rotulo: "Ativo" },
                          { valor: "suspensa", rotulo: "Suspenso (sem acesso)" },
                        ]}
                      />
                    </div>
                  </FormAcao>
                </div>
              )}
            </details>
          </li>
        ))}
      </ul>
      <Paginacao pagina={pagina} total={total} params={{ q: sp.q }} />

      {convites.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Convites recentes</h2>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {convites.map((c) => (
              <li key={c.id}>
                {c.email} · {c.status === "enviado" ? "convite enviado" : "vinculado a conta existente"} por {c.convidadoPor} em {formatarData(c.criadoEm)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
