import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { exigirModulo } from "@/lib/contexto";
import { salvarModeloPauta } from "@/lib/feedback/actions";
import { EstadoVazio, Selo } from "@/components/app/lista";
import { Cartao, CabecalhoCartao } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo, Interruptor } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Modelos de pauta" };

export default async function ModelosPautaPage() {
  const r = await exigirModulo("feedback", "administrar");
  if (r.escopo !== "todos") redirect("/feedback");
  const modelos = await r.db.modeloPauta.findMany({ orderBy: { nome: "asc" } });
  const somenteLeitura = !!r.ctx.suporte;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,380px)]">
      <section aria-labelledby="modelos" className="flex flex-col gap-3">
        <h2 id="modelos" className="font-heading text-lg font-bold">
          Modelos de pauta
        </h2>
        {modelos.length === 0 ? (
          <EstadoVazio titulo="Nenhum modelo de pauta" descricao="Modelos dão consistência aos 1:1 da organização. O gestor pode complementar a pauta em cada reunião." />
        ) : (
          <ul className="flex flex-col gap-3">
            {modelos.map((m) => (
              <li key={m.id}>
                <Cartao className="p-5">
                  <details>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                      <span>
                        <span className="font-heading font-bold">{m.nome}</span>
                        <span className="block text-xs text-muted-foreground">{m.itens.length} tópico(s) · criado por {m.criadoPor}</span>
                      </span>
                      <Selo tom={m.ativo ? "sucesso" : "neutro"}>{m.ativo ? "Ativo" : "Inativo"}</Selo>
                    </summary>
                    <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-sm">
                      {m.itens.map((i, n) => (
                        <li key={n}>{i}</li>
                      ))}
                    </ol>
                    {!somenteLeitura && (
                      <FormAcao action={salvarModeloPauta} textoBotao="Salvar alterações" variante="outline" className="mt-4 border-t border-border pt-4">
                        <input type="hidden" name="id" value={m.id} />
                        <Campo nome="nome" idCampo={`nome-${m.id}`} rotulo="Nome" defaultValue={m.nome} required />
                        <Area nome="itens" idCampo={`itens-${m.id}`} rotulo="Tópicos (um por linha)" defaultValue={m.itens.join("\n")} rows={5} />
                        <Interruptor nome="ativo" rotulo="Modelo ativo" marcado={m.ativo} ajuda="Inativo não aparece ao agendar." />
                      </FormAcao>
                    )}
                  </details>
                </Cartao>
              </li>
            ))}
          </ul>
        )}
      </section>
      {!somenteLeitura && (
        <Cartao aria-labelledby="novo">
          <CabecalhoCartao id="novo" titulo="Novo modelo" />
          <div className="px-5 pb-5">
            <FormAcao action={salvarModeloPauta} textoBotao="Criar modelo" limparAoConcluir>
              <Campo nome="nome" rotulo="Nome" required placeholder="Ex.: 1:1 quinzenal" />
              <Area nome="itens" rotulo="Tópicos (um por linha)" rows={6} placeholder={"Como você está?\nPrioridades da quinzena\nBloqueios\nDesenvolvimento"} />
            </FormAcao>
          </div>
        </Cartao>
      )}
    </div>
  );
}
