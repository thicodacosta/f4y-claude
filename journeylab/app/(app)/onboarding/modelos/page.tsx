import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { exigirModulo } from "@/lib/contexto";
import { salvarModelo } from "@/lib/onboarding/actions";
import { formatarData } from "@/lib/formato";
import { EstadoVazio, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Modelos de onboarding" };

export default async function ModelosPage() {
  const { db } = await exigirModulo("onboarding", "editar").then(async (r) => {
    if (r.escopo !== "todos") redirect("/onboarding");
    return r;
  });
  const modelos = await db.modeloOnboarding.findMany({
    include: { _count: { select: { etapas: true, onboardings: true } }, etapas: { select: { _count: { select: { tarefas: true } } } } },
    orderBy: { nome: "asc" },
  });
  return (
    <>
      {modelos.length === 0 ? (
        <EstadoVazio titulo="Nenhum modelo" descricao="Crie um modelo com etapas e tarefas para aplicar a novos colaboradores." />
      ) : (
        <Tabela colunas={["Modelo", "Etapas", "Tarefas", "Usos", "Criado", "Situação"]} minWidth={720}>
          {modelos.map((m) => (
            <tr key={m.id}>
              <Celula>
                <Link href={`/onboarding/modelos/${m.id}`} className="font-medium hover:text-teal-strong">{m.nome}</Link>
                {m.descricao && <span className="block text-xs text-muted-foreground">{m.descricao}</span>}
              </Celula>
              <Celula className="tabular-nums">{m._count.etapas}</Celula>
              <Celula className="tabular-nums">{m.etapas.reduce((s, e) => s + e._count.tarefas, 0)}</Celula>
              <Celula className="tabular-nums">{m._count.onboardings}</Celula>
              <Celula className="tabular-nums text-muted-foreground">{formatarData(m.criadoEm)}</Celula>
              <Celula><Selo tom={m.ativo ? "sucesso" : "neutro"}>{m.ativo ? "Ativo" : "Inativo"}</Selo></Celula>
            </tr>
          ))}
        </Tabela>
      )}
      <section className="rounded-lg border border-dashed border-border p-5">
        <h2 className="mb-3 font-heading text-lg font-bold">Novo modelo</h2>
        <FormAcao action={salvarModelo} textoBotao="Criar modelo">
          <div className="grid gap-3 md:grid-cols-2">
            <Campo nome="nome" rotulo="Nome" required placeholder="Ex.: Integração — Tecnologia" />
            <Campo nome="descricao" rotulo="Descrição" />
            <Area nome="boasVindas" rotulo="Mensagem de boas-vindas" rows={3} className="md:col-span-2" />
          </div>
        </FormAcao>
      </section>
    </>
  );
}
