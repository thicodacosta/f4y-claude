import { getPoolTalentos } from "@/modules/alocacao/queries";
import { serializeCandidato } from "@/modules/ats/serialize";
import { CandidatosGrid } from "@/components/ats/candidatos-grid";

export default async function PoolTalentosPage() {
  const candidatos = await getPoolTalentos();

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Pool de talentos</h1>
        <p className="text-sm text-muted-foreground">
          Profissionais disponíveis para alocação — disponibilidade diferente de indisponível.
        </p>
      </div>
      <CandidatosGrid candidatos={candidatos.map(serializeCandidato)} />
    </div>
  );
}
