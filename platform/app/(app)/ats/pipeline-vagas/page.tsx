import {
  getPipelineVagas,
  getVagas,
  getEmpresasParaVaga,
  getVagasFechadasPorPeriodo,
  getVagasAtivasPorVertical,
  getFunilVagasComValor,
  getContatosParaFechamento,
} from "@/modules/ats/queries";
import { getSessionUsuario } from "@/lib/auth";
import { PAPEIS_ADMIN } from "@/lib/roles";
import { serializeVaga, serializeVagaEtapa } from "@/modules/ats/serialize";
import { PipelineVagasView } from "@/components/ats/pipeline-vagas-view";
import { RelatorioPipelineVagas } from "@/components/ats/relatorio-pipeline-vagas";

export default async function PipelineVagasPage() {
  const [pipeline, vagas, empresas, contatos, vagasFechadasPorPeriodo, funil, porVertical, usuario] = await Promise.all([
    getPipelineVagas(),
    getVagas(),
    getEmpresasParaVaga(),
    getContatosParaFechamento(),
    getVagasFechadasPorPeriodo(24),
    getFunilVagasComValor(),
    getVagasAtivasPorVertical(),
    getSessionUsuario(),
  ]);
  const mostrarValor = !!usuario?.papel && (PAPEIS_ADMIN as string[]).includes(usuario.papel);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Pipeline de Vagas</h1>
        <p className="text-sm text-muted-foreground">
          Arraste os cards entre as etapas — cada mudança é salva na hora.
        </p>
      </div>
      <RelatorioPipelineVagas funil={funil} porVertical={porVertical} fechadasPorPeriodo={vagasFechadasPorPeriodo} />
      <PipelineVagasView
        etapas={pipeline.etapas.map(serializeVagaEtapa)}
        vagas={vagas.map(serializeVaga)}
        empresas={empresas}
        contatos={contatos}
        mostrarValor={mostrarValor}
      />
    </div>
  );
}
