import { requirePapel } from "@/lib/auth";
import { PAPEIS_GESTAO } from "@/lib/roles";
import { getUsuariosParaMetas, getMetasEquipe } from "@/modules/metas/queries";
import { MetasEditor } from "@/components/configuracoes/metas-editor";

export default async function MetasPage() {
  await requirePapel(PAPEIS_GESTAO);
  const [usuarios, metas] = await Promise.all([getUsuariosParaMetas(), getMetasEquipe()]);

  const hoje = new Date();

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Metas</h1>
        <p className="text-sm text-muted-foreground">
          Metas de {hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} — progresso calculado
          contra o desempenho real do mês.
        </p>
      </div>
      <MetasEditor usuarios={usuarios} metas={metas} />
    </div>
  );
}
