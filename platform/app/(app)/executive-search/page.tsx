import { requirePapel } from "@/lib/auth";
import { PAPEIS_EXECUTIVE_SEARCH } from "@/lib/roles";
import { getVagas } from "@/modules/ats/queries";
import { serializeVaga } from "@/modules/ats/serialize";
import { VagasTable } from "@/components/ats/vagas-table";

export default async function ExecutiveSearchPage() {
  await requirePapel(PAPEIS_EXECUTIVE_SEARCH);

  const vagas = await getVagas();
  const vagasEs = vagas.filter((v) => v.executiveSearch).map(serializeVaga);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Executive Search</h1>
        <p className="text-sm text-muted-foreground">
          Busca executiva confidencial — mapeamento de mercado e shortlist, restrito a quem tem o papel.
        </p>
      </div>
      <VagasTable vagas={vagasEs} />
    </div>
  );
}
