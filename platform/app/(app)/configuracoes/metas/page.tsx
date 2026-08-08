import { requirePapel } from "@/lib/auth";
import { PAPEIS_GESTAO } from "@/lib/roles";
import { getUsuariosParaMetas, getMetasEquipe, getMetasOrganizacionais } from "@/modules/metas/queries";
import { MetasEditor } from "@/components/configuracoes/metas-editor";
import { MetasOrganizacionaisEditor } from "@/components/configuracoes/metas-organizacionais-editor";

export default async function MetasPage() {
  await requirePapel(PAPEIS_GESTAO);
  const [usuarios, metas, metasOrganizacionais] = await Promise.all([
    getUsuariosParaMetas(),
    getMetasEquipe(),
    getMetasOrganizacionais(),
  ]);

  const hoje = new Date();
  const mesAtual = hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Metas</h1>
        <p className="text-sm text-muted-foreground">
          Metas de {mesAtual} — progresso calculado contra o desempenho real do mês.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Goal Center — empresa e verticais</h2>
          <p className="text-sm text-muted-foreground">
            Alimenta o Forecast Engine e o Gap-to-Goal em Find4You Intelligence.
          </p>
        </div>
        <MetasOrganizacionaisEditor metas={metasOrganizacionais} />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Metas por pessoa</h2>
          <p className="text-sm text-muted-foreground">Comercial e recrutamento, individuais.</p>
        </div>
        <MetasEditor usuarios={usuarios} metas={metas} />
      </div>
    </div>
  );
}
