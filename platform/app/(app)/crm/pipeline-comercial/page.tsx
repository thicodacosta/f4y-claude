import { getPipelineComercial, getOportunidades, getEmpresas, getConsultoresComerciais } from "@/modules/crm/queries";
import { serializeOportunidade, serializeEtapa } from "@/modules/crm/serialize";
import { PipelineComercialView } from "@/components/crm/pipeline-comercial-view";

export default async function PipelineComercialPage() {
  const [pipeline, oportunidades, empresas, consultores] = await Promise.all([
    getPipelineComercial(),
    getOportunidades(),
    getEmpresas(),
    getConsultoresComerciais(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Pipeline Comercial</h1>
        <p className="text-sm text-muted-foreground">
          Arraste os cards entre as etapas — cada mudança é salva na hora.
        </p>
      </div>
      <PipelineComercialView
        etapas={pipeline.etapas.map(serializeEtapa)}
        oportunidades={oportunidades.map(serializeOportunidade)}
        empresas={empresas.map((e) => ({ id: e.id, nome: e.nome }))}
        consultores={consultores.map((c) => ({ id: c.id, nome: c.nome }))}
      />
    </div>
  );
}
