import { notFound } from "next/navigation";
import { getVaga, getEquipeAts, getAtividadesDaVaga } from "@/modules/ats/queries";
import { serializeVaga, serializeVagaCandidato } from "@/modules/ats/serialize";
import { getContratosDaVaga } from "@/modules/alocacao/queries";
import { VagaDetailView } from "@/components/ats/vaga-detail-view";

export default async function VagaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [vaga, equipe, atividades] = await Promise.all([getVaga(id), getEquipeAts(), getAtividadesDaVaga(id)]);

  if (!vaga) notFound();

  const contratos = vaga.vertical === "alocacao_tech" ? await getContratosDaVaga(id) : [];

  return (
    <VagaDetailView
      vaga={serializeVaga(vaga)}
      candidatos={vaga.candidatos.map(serializeVagaCandidato)}
      equipe={equipe.map((u) => ({ id: u.id, nome: u.nome }))}
      atividadesIniciais={atividades}
      contratos={contratos.map((c) => ({
        id: c.id,
        candidatoNome: c.candidato.nome,
        rate: Number(c.rate),
        prazoMeses: c.prazoMeses,
        dataInicio: c.dataInicio.toISOString(),
        dataFim: c.dataFim.toISOString(),
        status: c.status,
      }))}
    />
  );
}
