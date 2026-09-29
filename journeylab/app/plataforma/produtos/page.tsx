import type { Metadata } from "next";
import { exigirSuperadmin } from "@/lib/contexto";
import { salvarProdutoExterno } from "@/lib/plataforma/actions";
import { MODULOS, NOME_MODULO, type Modulo } from "@/lib/permissoes";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo, Interruptor, Marcadores, Selecao } from "@/components/admin/campos";
import { EstadoVazio } from "@/components/app/lista";

export const metadata: Metadata = { title: "Produtos externos — Administração" };

function FormProduto({ p }: { p?: { id: string; canal: string; idExterno: string; descricao: string; modulos: string[]; duracaoDias: number | null; ativo: boolean } }) {
  return (
    <FormAcao action={salvarProdutoExterno} textoBotao={p ? "Salvar" : "Cadastrar produto"} limparAoConcluir={!p}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-3 md:grid-cols-4">
        <Selecao nome="canal" rotulo="Canal" defaultValue={p?.canal ?? "kiwify"} opcoes={[{ valor: "kiwify", rotulo: "Kiwify" }, { valor: "site", rotulo: "Site próprio" }]} />
        <Campo nome="idExterno" rotulo="Id do produto no canal" defaultValue={p?.idExterno} required />
        <Campo nome="descricao" rotulo="Descrição interna" defaultValue={p?.descricao} required />
        <Campo nome="duracaoDias" rotulo="Duração do acesso (dias)" type="number" min={1} defaultValue={p?.duracaoDias ?? ""} ajuda="Vazio = sem prazo." />
      </div>
      <Marcadores nome="modulos" rotulo="Módulos que a compra ativa" marcados={p?.modulos ?? []} opcoes={MODULOS.map((m) => ({ valor: m.chave, rotulo: m.nome }))} />
      <Interruptor nome="ativo" rotulo="Mapeamento ativo" marcado={p?.ativo ?? true} />
    </FormAcao>
  );
}

export default async function ProdutosExternosPage() {
  const { db } = await exigirSuperadmin();
  const produtos = await db.produtoExterno.findMany({ orderBy: { criadoEm: "desc" } });
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-[28px] font-bold tracking-tight">Produtos externos</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Associe cada produto vendido na Kiwify ou no site aos módulos que ele libera. Preço e plano ficam no canal de
          venda; aqui fica só o efeito no acesso. A compra confirmada ativará os módulos pelo mesmo serviço usado na
          ativação manual, com origem e referência registradas no histórico.
        </p>
      </div>
      {produtos.length === 0 ? (
        <EstadoVazio titulo="Nenhum produto mapeado" descricao="Cadastre o primeiro produto externo abaixo." />
      ) : (
        <ul className="flex flex-col gap-3">
          {produtos.map((p) => (
            <li key={p.id} className="rounded-lg border border-border bg-card">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="font-semibold">{p.descricao}</span>
                  <span className="text-sm text-muted-foreground">
                    {p.canal} · {p.idExterno} · {p.modulos.map((m) => NOME_MODULO[m as Modulo]).join(", ")}
                    {p.duracaoDias ? ` · ${p.duracaoDias} dias` : " · sem prazo"}
                    {!p.ativo && " · inativo"}
                  </span>
                </summary>
                <div className="border-t border-border p-4">
                  <FormProduto p={p} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <section className="rounded-lg border border-dashed border-border p-4">
        <p className="mb-3 text-sm font-semibold">Novo produto</p>
        <FormProduto />
      </section>
    </>
  );
}
