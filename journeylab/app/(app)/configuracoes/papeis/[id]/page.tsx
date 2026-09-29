import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { dbTenant } from "@/lib/db";
import { exigirContexto, pode } from "@/lib/contexto";
import { salvarPermissoes } from "@/lib/organizacao/actions";
import { ACOES, AREAS } from "@/lib/permissoes";
import { FormAcao } from "@/components/admin/form-acao";

export const metadata: Metadata = { title: "Permissões do papel" };

export default async function PapelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirContexto();
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const papel = await db.papel.findUnique({ where: { id }, include: { permissoes: true } });
  if (!papel) notFound();
  const podeEditar = !!pode(ctx, "organizacao", "administrar");
  const atual = new Map(papel.permissoes.map((p) => [`${p.area}:${p.acao}`, p.escopo]));

  const matriz = (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-semibold">Área</th>
            {ACOES.map((a) => (
              <th key={a.chave} scope="col" className="px-2 py-2.5 font-semibold">{a.nome}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {AREAS.map((area) => (
            <tr key={area.chave}>
              <th scope="row" className="px-4 py-2 text-left font-medium">
                {area.nome}
                {area.chave !== "organizacao" && area.chave !== "cadastro" && !ctx.modulos.has(area.chave) && (
                  <span className="block text-xs font-normal text-muted-foreground">módulo não contratado</span>
                )}
              </th>
              {ACOES.map((acao) => (
                <td key={acao.chave} className="px-2 py-2">
                  <label className="sr-only" htmlFor={`p-${area.chave}-${acao.chave}`}>
                    {area.nome} — {acao.nome}
                  </label>
                  <select
                    id={`p-${area.chave}-${acao.chave}`}
                    name={`p:${area.chave}:${acao.chave}`}
                    defaultValue={atual.get(`${area.chave}:${acao.chave}`) ?? ""}
                    disabled={!podeEditar}
                    className="h-8 w-full min-w-[88px] rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <option value="">—</option>
                    <option value="proprio">Próprio</option>
                    <option value="equipe">Equipe</option>
                    <option value="todos">Todos</option>
                  </select>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div>
        <Link href="/configuracoes/papeis" className="text-sm text-muted-foreground hover:text-foreground">← Papéis</Link>
        <h2 className="mt-2 font-heading text-xl font-bold">{papel.nome}</h2>
        <p className="text-sm text-muted-foreground">
          “—” = sem permissão. Anotações de Feedback 1:1 e respostas de Pulse/NR-1 seguem regras de confidencialidade
          próprias, independentemente desta matriz.
        </p>
      </div>
      {podeEditar ? (
        <FormAcao action={salvarPermissoes} textoBotao="Salvar permissões">
          <input type="hidden" name="papelId" value={papel.id} />
          {matriz}
        </FormAcao>
      ) : (
        matriz
      )}
    </>
  );
}
