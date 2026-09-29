import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirContexto, pode } from "@/lib/contexto";
import { dbTenant } from "@/lib/db";
import { CATEGORIAS_RETENCAO, type CategoriaRetencao } from "@/lib/retencao";
import { executarRetencaoAgora, salvarRetencao } from "@/lib/organizacao/actions";
import { formatarDataHora } from "@/lib/formato";
import { Cartao, CabecalhoCartao } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Retenção de dados" };

export default async function RetencaoPage() {
  const ctx = await exigirContexto();
  const escopo = pode(ctx, "organizacao", "visualizar");
  if (!escopo) redirect("/inicio");
  const administra = pode(ctx, "organizacao", "administrar") === "todos";
  const pol = await dbTenant(ctx.org.id, ctx.usuario.id).politicaRetencao.findUnique({ where: { tenantId: ctx.org.id } });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
      <Cartao aria-labelledby="politica">
        <CabecalhoCartao
          id="politica"
          titulo="Política de retenção"
          descricao="Prazo, em meses, após o qual cada categoria é eliminada. Campo vazio: a categoria não é eliminada automaticamente."
        />
        <div className="px-5 pb-5">
          <FormAcao action={salvarRetencao} textoBotao="Salvar política">
            <fieldset disabled={!administra} className="flex flex-col gap-4">
              {(Object.keys(CATEGORIAS_RETENCAO) as CategoriaRetencao[]).map((k) => (
                <Campo
                  key={k}
                  nome={k}
                  rotulo={`${CATEGORIAS_RETENCAO[k].nome} (meses)`}
                  ajuda={CATEGORIAS_RETENCAO[k].ajuda}
                  type="number"
                  min={1}
                  max={240}
                  inputMode="numeric"
                  defaultValue={pol?.[k] ?? ""}
                  placeholder="Não eliminar"
                />
              ))}
            </fieldset>
          </FormAcao>
          <p className="mt-4 text-xs text-muted-foreground">
            Não há prazo padrão: defina-os com base na finalidade de cada dado e nas orientações do encarregado de dados (DPO) e do jurídico da sua organização.
            Suspender ou encerrar um módulo nunca apaga dados — só esta política elimina.
          </p>
        </div>
      </Cartao>

      <div className="flex flex-col gap-4">
        <Cartao className="p-5">
          <h3 className="font-heading text-base font-bold">Execução</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            A rotina diária aplica a política automaticamente. Última execução: {pol?.ultimaExecucao ? formatarDataHora(pol.ultimaExecucao.toISOString()) : "nunca"}.
            {pol?.atualizadoPor && ` Política atualizada por ${pol.atualizadoPor}.`}
          </p>
          {administra && !ctx.suporte && pol && (
            <div className="mt-4 flex flex-col gap-4">
              <FormAcao action={executarRetencaoAgora} textoBotao="Simular" variante="outline">
                <input type="hidden" name="modo" value="simular" />
              </FormAcao>
              <FormAcao action={executarRetencaoAgora} textoBotao="Aplicar agora" variante="destructive" className="border-t border-border pt-4">
                <input type="hidden" name="modo" value="aplicar" />
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="confirmo" className="mt-0.5 size-4 accent-[var(--destructive)]" />
                  Entendo que a exclusão é definitiva e fica registrada na auditoria.
                </label>
              </FormAcao>
            </div>
          )}
        </Cartao>
      </div>
    </div>
  );
}
