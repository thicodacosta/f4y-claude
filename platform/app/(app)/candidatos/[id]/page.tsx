import { notFound } from "next/navigation";
import { getCandidato, getEdicoesPendentesDoCandidato } from "@/modules/ats/queries";
import { serializeCandidato } from "@/modules/ats/serialize";
import { getSessionUsuario } from "@/lib/auth";
import { PAPEIS_EXECUTIVE_SEARCH } from "@/lib/roles";
import { getAbordagensConfidenciais } from "@/modules/executive-search/queries";
import { getCandidatoTemPortal } from "@/modules/portal/queries";
import { getTimelineUnificadaCandidato } from "@/modules/timeline/queries";
import { CandidatoProfileView } from "@/components/ats/candidato-profile-view";

export default async function CandidatoProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [candidato, usuario, temPortal, edicoesPendentes, timeline] = await Promise.all([
    getCandidato(id),
    getSessionUsuario(),
    getCandidatoTemPortal(id),
    getEdicoesPendentesDoCandidato(id),
    getTimelineUnificadaCandidato(id),
  ]);

  if (!candidato) notFound();

  const podeVerAbordagens = !!usuario?.papel && (PAPEIS_EXECUTIVE_SEARCH as string[]).includes(usuario.papel);
  const abordagens = podeVerAbordagens ? await getAbordagensConfidenciais(id) : [];

  return (
    <CandidatoProfileView
      candidato={serializeCandidato(candidato)}
      processos={candidato.vagas.map((vc) => ({
        id: vc.id,
        etapa: vc.etapa,
        criadoEm: vc.criadoEm.toISOString(),
        fitScore: vc.fitScore ? Number(vc.fitScore) : null,
        vaga: {
          id: vc.vaga.id,
          cargo: vc.vaga.cargo,
          vertical: vc.vaga.vertical,
          empresa: { nome: vc.vaga.empresa.nome },
        },
      }))}
      abordagensConfidenciais={podeVerAbordagens ? abordagens : null}
      temPortal={temPortal}
      edicoesPendentes={edicoesPendentes}
      timeline={timeline}
    />
  );
}
