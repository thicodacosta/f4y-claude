import { requirePapel } from "@/lib/auth";
import { PAPEIS_ADMIN } from "@/lib/roles";
import { getPipelineComercial } from "@/modules/crm/queries";
import { serializeEtapa } from "@/modules/crm/serialize";
import { PipelineEtapasEditor } from "@/components/crm/pipeline-etapas-editor";

export default async function ConfiguracoesPipelinesPage() {
  await requirePapel(PAPEIS_ADMIN);
  const pipeline = await getPipelineComercial();

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Configurações · Pipelines</h1>
        <p className="text-sm text-muted-foreground">
          Crie, renomeie, reordene e exclua etapas do {pipeline.nome}. Mudanças aparecem na hora
          para todo mundo.
        </p>
      </div>
      <PipelineEtapasEditor
        pipelineId={pipeline.id}
        etapasIniciais={pipeline.etapas.map(serializeEtapa)}
      />
    </div>
  );
}
