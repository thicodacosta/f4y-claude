import { requirePapel } from "@/lib/auth";
import { PAPEIS_GESTAO } from "@/lib/roles";
import {
  getProdutividadeConsultores,
  getProdutividadeRecrutadores,
  getHeatmapAtividade,
} from "@/modules/relatorios/produtividade";
import { getMetasEquipe } from "@/modules/metas/queries";
import { ProdutividadeView } from "@/components/relatorios/produtividade-view";

export default async function ProdutividadePage() {
  await requirePapel(PAPEIS_GESTAO);

  const hoje = new Date();
  const [consultores, recrutadores, heatmap, metas] = await Promise.all([
    getProdutividadeConsultores(),
    getProdutividadeRecrutadores(),
    getHeatmapAtividade(),
    getMetasEquipe(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Produtividade</h1>
        <p className="text-sm text-muted-foreground">
          {hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} — desempenho por pessoa e atividade
          registrada.
        </p>
      </div>
      <ProdutividadeView
        consultores={consultores}
        recrutadores={recrutadores}
        heatmap={heatmap}
        metas={metas}
        ano={hoje.getFullYear()}
        mes={hoje.getMonth() + 1}
      />
    </div>
  );
}
