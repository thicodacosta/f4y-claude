import { getCandidatos } from "@/modules/ats/queries";
import { serializeCandidato } from "@/modules/ats/serialize";
import { CandidatosGrid } from "@/components/ats/candidatos-grid";

export default async function CandidatosPage() {
  const candidatos = await getCandidatos();

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Candidatos</h1>
        <p className="text-sm text-muted-foreground">
          Base de candidatos — perfil, busca avançada e histórico de processos.
        </p>
      </div>
      <CandidatosGrid candidatos={candidatos.map(serializeCandidato)} />
    </div>
  );
}
