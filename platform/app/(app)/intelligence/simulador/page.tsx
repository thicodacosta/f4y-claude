import {
  getBaselineSimulador,
  getReceitaConsolidada,
  getTicketMedioPorVertical,
  getReceitaPorVerticalNegocio,
  getConcentracaoReceita,
  getPipelineConsolidado,
} from "@/modules/intelligence/metrics";
import { getKpisComercial } from "@/modules/dashboard/queries";
import { SimuladorView } from "@/components/intelligence/simulador-view";

export default async function SimuladorPage() {
  const [baseline, receita, ticketPorVertical, receitaPorVertical, concentracao, pipeline, kpisComercial] = await Promise.all([
    getBaselineSimulador(),
    getReceitaConsolidada(),
    getTicketMedioPorVertical(),
    getReceitaPorVerticalNegocio(),
    getConcentracaoReceita(10),
    getPipelineConsolidado(),
    getKpisComercial(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Business Simulator</h1>
        <p className="text-sm text-muted-foreground">
          Altere as variáveis e veja o impacto na hora — tudo calculado sobre a base real de hoje.
        </p>
      </div>

      <SimuladorView
        receitaMensalAtual={receita.receitaMes}
        clientesAtivos={baseline.clientesAtivos}
        ticketMedioGeral={baseline.ticketMedioGeral}
        recrutadoresAtivos={baseline.recrutadoresAtivos}
        vagasFechadasPorRecrutadorMes={baseline.vagasFechadasPorRecrutadorMes}
        pipelinePonderadoAtual={pipeline.pipelinePonderado}
        taxaConversaoComercial={kpisComercial.taxaConversao}
        clientesParaSimularPerda={concentracao?.clientes ?? []}
        ticketPorVertical={ticketPorVertical}
        receitaPorVertical={receitaPorVertical}
      />
    </div>
  );
}
