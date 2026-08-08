import { getForecastMultiplasJanelas, getGapToGoal } from "@/modules/intelligence/forecast";
import { categoriaMetaValues } from "@/modules/metas/schemas";
import { ForecastView } from "@/components/intelligence/forecast-view";

export default async function ForecastPage() {
  const [janelas, gaps] = await Promise.all([
    getForecastMultiplasJanelas(),
    Promise.all(categoriaMetaValues.map((categoria) => getGapToGoal(categoria))),
  ]);

  const gapsValidos = gaps.filter((g): g is NonNullable<typeof g> => g != null);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Forecast Engine</h1>
        <p className="text-sm text-muted-foreground">
          Conservador (só pipeline com data e probabilidade), provável (+ tendência histórica) e agressivo (tudo
          previsto fechando). Sem modelo estatístico — fórmula auditável em cada banda.
        </p>
      </div>

      <ForecastView janelas={janelas} gaps={gapsValidos} />
    </div>
  );
}
