import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { dbTenant } from "@/lib/db";
import { exigirContexto, pode } from "@/lib/contexto";
import { salvarArea, salvarEquipe } from "@/lib/organizacao/actions";
import { CabecalhoPagina } from "@/components/secao";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo, Selecao } from "@/components/admin/campos";
import { EstadoVazio } from "@/components/app/lista";

export const metadata: Metadata = { title: "Áreas e equipes" };

export default async function EquipesPage() {
  const ctx = await exigirContexto();
  const escopo = pode(ctx, "cadastro", "visualizar");
  if (!escopo || escopo === "proprio") redirect("/inicio");
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const [areas, equipes, pessoas] = await Promise.all([
    db.area.findMany({ orderBy: { nome: "asc" } }),
    db.equipe.findMany({
      include: { area: { select: { nome: true } }, gestor: { select: { nome: true } }, _count: { select: { membros: { where: { status: { not: "desligado" } } } } } },
      orderBy: { nome: "asc" },
    }),
    db.colaborador.findMany({ where: { status: { not: "desligado" } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  const podeEditar = pode(ctx, "cadastro", "editar") === "todos";
  const podeCriar = pode(ctx, "cadastro", "criar") === "todos";
  const opcoesAreas = [{ valor: "", rotulo: "Sem área" }, ...areas.map((a) => ({ valor: a.id, rotulo: a.nome }))];
  const opcoesGestor = [{ valor: "", rotulo: "Sem gestor" }, ...pessoas.map((p) => ({ valor: p.id, rotulo: p.nome }))];

  return (
    <>
      <CabecalhoPagina
        titulo="Áreas e equipes"
        descricao="Estrutura organizacional compartilhada. O gestor de uma equipe passa a ver seus membros nos módulos de acompanhamento."
      />

      <section aria-labelledby="equipes" className="flex flex-col gap-3">
        <h2 id="equipes" className="font-heading text-lg font-bold">Equipes</h2>
        {equipes.length === 0 ? (
          <EstadoVazio titulo="Nenhuma equipe" descricao="Crie equipes para organizar pessoas e definir gestores." />
        ) : (
          <ul className="flex flex-col gap-3">
            {equipes.map((e) => (
              <li key={e.id} className="rounded-lg border border-border bg-card">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="font-semibold">{e.nome}</span>
                    <span className="text-sm text-muted-foreground">
                      {e.area?.nome ?? "Sem área"} · Gestor: {e.gestor?.nome ?? "—"} · {e._count.membros} pessoas
                    </span>
                  </summary>
                  {podeEditar && (
                    <div className="border-t border-border p-4">
                      <FormAcao action={salvarEquipe} textoBotao="Salvar equipe">
                        <input type="hidden" name="id" value={e.id} />
                        <div className="grid gap-3 md:grid-cols-3">
                          <Campo nome="nome" rotulo="Nome" defaultValue={e.nome} required />
                          <Selecao nome="areaId" rotulo="Área" defaultValue={e.areaId ?? ""} opcoes={opcoesAreas} />
                          <Selecao nome="gestorId" rotulo="Gestor" defaultValue={e.gestorId ?? ""} opcoes={opcoesGestor} />
                        </div>
                      </FormAcao>
                    </div>
                  )}
                </details>
              </li>
            ))}
          </ul>
        )}
        {podeCriar && (
          <div className="rounded-lg border border-dashed border-border p-4">
            <p className="mb-3 text-sm font-semibold">Nova equipe</p>
            <FormAcao action={salvarEquipe} textoBotao="Criar equipe" limparAoConcluir>
              <div className="grid gap-3 md:grid-cols-3">
                <Campo nome="nome" rotulo="Nome" required />
                <Selecao nome="areaId" rotulo="Área" opcoes={opcoesAreas} />
                <Selecao nome="gestorId" rotulo="Gestor" opcoes={opcoesGestor} />
              </div>
            </FormAcao>
          </div>
        )}
      </section>

      <section aria-labelledby="areas" className="flex flex-col gap-3">
        <h2 id="areas" className="font-heading text-lg font-bold">Áreas</h2>
        <ul className="flex flex-wrap gap-2">
          {areas.map((a) => (
            <li key={a.id} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">{a.nome}</li>
          ))}
          {areas.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma área cadastrada.</li>}
        </ul>
        {podeCriar && (
          <FormAcao action={salvarArea} textoBotao="Criar área" limparAoConcluir className="max-w-md">
            <Campo nome="nome" rotulo="Nova área" required />
          </FormAcao>
        )}
      </section>
    </>
  );
}
