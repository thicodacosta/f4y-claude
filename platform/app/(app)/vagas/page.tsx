import { getVagas } from "@/modules/ats/queries";
import { serializeVaga } from "@/modules/ats/serialize";
import { VagasTable } from "@/components/ats/vagas-table";

export default async function VagasPage() {
  const vagas = await getVagas();

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Vagas</h1>
        <p className="text-sm text-muted-foreground">
          Todas as vagas abertas, pausadas e fechadas, em todas as verticais.
        </p>
      </div>
      <VagasTable vagas={vagas.map(serializeVaga)} />
    </div>
  );
}
