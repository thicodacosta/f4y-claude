import type { Metadata } from "next";
import { exigirModulo, pode } from "@/lib/contexto";
import { carregarConfigAnalytics } from "@/lib/analytics/base";
import { CabecalhoCartao, Cartao } from "@/components/app/painel";
import { EditorReferencias } from "@/components/analytics/editor-referencias";

export const metadata: Metadata = { title: "Referências — People Analytics" };

export default async function ReferenciasPage() {
  const { ctx } = await exigirModulo("analytics");
  const config = await carregarConfigAnalytics(ctx);
  const editar = !!pode(ctx, "analytics", "editar");
  return (
    <Cartao>
      <CabecalhoCartao
        titulo="Referências de mercado e premissas"
        descricao="Os valores iniciais são pontos de partida do JourneyLab, não dados oficiais. Substitua pelo benchmark do seu setor e porte (pesquisas salariais, consultorias, associações setoriais) para um comparativo fiel."
      />
      <div className="px-5 pb-5">
        <EditorReferencias inicial={config} somenteLeitura={!editar} />
        {!editar && <p className="mt-4 text-sm text-muted-foreground">Somente leitura: seu papel não pode alterar as referências.</p>}
      </div>
    </Cartao>
  );
}
