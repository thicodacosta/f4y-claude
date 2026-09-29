import type { Metadata } from "next";
import { dbTenant } from "@/lib/db";
import { exigirContexto } from "@/lib/contexto";
import { MODULOS, NOME_MODULO, STATUS_ENTITLEMENT, type Modulo } from "@/lib/permissoes";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { Celula, Tabela } from "@/components/app/tabela";
import { Selo } from "@/components/app/lista";

export const metadata: Metadata = { title: "Módulos contratados" };

export default async function ModulosPage() {
  const ctx = await exigirContexto();
  const historico = await dbTenant(ctx.org.id, ctx.usuario.id).historicoEntitlement.findMany({ orderBy: { criadoEm: "desc" }, take: 50 });
  return (
    <>
      <p className="max-w-3xl text-sm text-muted-foreground">
        A contratação e a suspensão de módulos são feitas pelo JourneyLab. Suspender ou encerrar um módulo bloqueia o
        acesso, mas não apaga os dados.
      </p>
      <Tabela colunas={["Módulo", "Situação", "Início", "Válido até", "Origem"]} minWidth={640}>
        {MODULOS.map((m) => {
          const e = ctx.entitlements.find((x) => x.modulo === m.chave);
          const liberado = ctx.modulos.has(m.chave);
          return (
            <tr key={m.chave}>
              <Celula className="font-medium">{m.nome}</Celula>
              <Celula>
                {e ? (
                  <Selo tom={liberado ? "sucesso" : "neutro"}>
                    {STATUS_ENTITLEMENT[e.status].nome}
                    {!liberado && STATUS_ENTITLEMENT[e.status].libera ? " (fora do período)" : ""}
                  </Selo>
                ) : (
                  <Selo>Não contratado</Selo>
                )}
              </Celula>
              <Celula className="tabular-nums text-muted-foreground">{e ? formatarData(e.inicio) : "—"}</Celula>
              <Celula className="tabular-nums text-muted-foreground">{e?.fim ? formatarData(e.fim) : e ? "Sem prazo" : "—"}</Celula>
              <Celula className="text-muted-foreground">—</Celula>
            </tr>
          );
        })}
      </Tabela>
      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-bold">Histórico de alterações</h2>
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem alterações registradas.</p>
        ) : (
          <Tabela colunas={["Quando", "Módulo", "De → Para", "Origem", "Responsável", "Motivo"]} minWidth={860}>
            {historico.map((h) => (
              <tr key={h.id}>
                <Celula className="tabular-nums whitespace-nowrap">{formatarDataHora(h.criadoEm.toISOString())}</Celula>
                <Celula>{NOME_MODULO[h.modulo as Modulo]}</Celula>
                <Celula>
                  {h.statusAnterior ? STATUS_ENTITLEMENT[h.statusAnterior].nome : "—"} → {STATUS_ENTITLEMENT[h.statusNovo].nome}
                </Celula>
                <Celula className="text-muted-foreground">{h.origem}</Celula>
                <Celula className="text-muted-foreground">{h.responsavelNome}</Celula>
                <Celula className="text-muted-foreground">{h.motivo ?? "—"}</Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </section>
    </>
  );
}
