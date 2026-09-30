import { redirect } from "next/navigation";

/** Endereço antigo da vaga no CRM → mesma vaga na Página de Carreiras. */
export default async function VagaCrm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/pagina-carreiras/vagas/${encodeURIComponent(id)}`);
}
