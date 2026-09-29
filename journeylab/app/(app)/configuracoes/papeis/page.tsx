import Link from "next/link";
import type { Metadata } from "next";
import { dbTenant } from "@/lib/db";
import { exigirContexto, pode } from "@/lib/contexto";
import { criarPapel } from "@/lib/organizacao/actions";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo, Selecao } from "@/components/admin/campos";
import { Celula, Tabela } from "@/components/app/tabela";

export const metadata: Metadata = { title: "Papéis e permissões" };

export default async function PapeisPage() {
  const ctx = await exigirContexto();
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const papeis = await db.papel.findMany({
    include: { _count: { select: { associacoes: true, permissoes: true } } },
    orderBy: [{ sistema: "desc" }, { nome: "asc" }],
  });
  const podeAdministrar = !!pode(ctx, "organizacao", "administrar");
  return (
    <>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Cada papel define, por módulo, quais ações são permitidas e em que escopo: <strong>próprio</strong> (só os
        próprios registros), <strong>equipe</strong> (pessoas geridas) ou <strong>todos</strong>.
      </p>
      <Tabela colunas={["Papel", "Tipo", "Pessoas", "Permissões"]} minWidth={560}>
        {papeis.map((p) => (
          <tr key={p.id}>
            <Celula>
              <Link href={`/configuracoes/papeis/${p.id}`} className="font-medium hover:text-teal-strong">
                {p.nome}
              </Link>
            </Celula>
            <Celula className="text-muted-foreground">{p.sistema ? "Padrão" : "Personalizado"}</Celula>
            <Celula className="tabular-nums">{p._count.associacoes}</Celula>
            <Celula className="tabular-nums">{p._count.permissoes}</Celula>
          </tr>
        ))}
      </Tabela>
      {podeAdministrar && (
        <section className="rounded-lg border border-dashed border-border p-4">
          <p className="mb-3 text-sm font-semibold">Novo papel</p>
          <FormAcao action={criarPapel} textoBotao="Criar papel">
            <div className="grid gap-3 md:grid-cols-2">
              <Campo nome="nome" rotulo="Nome" required placeholder="Ex.: Business Partner" />
              <Selecao nome="copiarDe" rotulo="Copiar permissões de" opcoes={[{ valor: "", rotulo: "Começar sem permissões" }, ...papeis.map((p) => ({ valor: p.id, rotulo: p.nome }))]} />
            </div>
          </FormAcao>
        </section>
      )}
    </>
  );
}
