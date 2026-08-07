import { notFound } from "next/navigation";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_EXECUTIVE_SEARCH } from "@/lib/roles";
import { getVaga } from "@/modules/ats/queries";
import { serializeVaga, serializeVagaCandidato } from "@/modules/ats/serialize";
import { RelatorioPosicaoView } from "@/components/executive-search/relatorio-posicao-view";

export default async function RelatorioPosicaoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePapel(PAPEIS_EXECUTIVE_SEARCH);
  const { id } = await params;

  const vaga = await getVaga(id);
  if (!vaga) notFound();

  return (
    <RelatorioPosicaoView vaga={serializeVaga(vaga)} candidatos={vaga.candidatos.map(serializeVagaCandidato)} />
  );
}
