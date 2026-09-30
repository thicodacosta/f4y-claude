import type { Metadata } from "next";
import { CalendarClock, CheckCircle2, Lock } from "lucide-react";
import { carregarNr1Publico } from "@/lib/nr1/publico";
import { privacidadeNr1 } from "@/lib/nr1/envio";
import { formatarData } from "@/lib/formato";
import { FormularioNr1 } from "@/components/nr1/formulario-publico";

export const metadata: Metadata = { title: "Responder pesquisa", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function Aviso({ titulo, texto, icone: Icone = Lock }: { titulo: string; texto: string; icone?: typeof Lock }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-10 text-center shadow-surface">
      <Icone className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="font-heading text-2xl font-bold">{titulo}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}

/**
 * Página pública do Diagnóstico NR-1 (sem login). O link do convite é assinado
 * e validado no servidor; nenhum dado da pessoa convidada chega ao navegador.
 */
export default async function ResponderNr1({ params }: { params: Promise<{ token: string }> }) {
  const { token: bruto } = await params;
  const token = decodeURIComponent(bruto);
  const c = await carregarNr1Publico(token);
  const org = c.estado === "invalido" ? null : c.org;
  const cor = org?.corMarca && /^#[0-9a-fA-F]{6}$/.test(org.corMarca) ? org.corMarca : "#0B1F3A";
  const logo = org?.logoUrl && /^https:\/\//.test(org.logoUrl) ? org.logoUrl : null;

  let conteudo: React.ReactNode;
  if (c.estado === "invalido") conteudo = <Aviso titulo="Link inválido" texto="Este link não é válido ou a pesquisa não está disponível. Use o link recebido por e-mail." />;
  else if (c.estado === "encerrada") conteudo = <Aviso titulo="Pesquisa encerrada" texto="Esta pesquisa não recebe mais respostas. Obrigado pelo interesse." />;
  else if (c.estado === "nao_iniciada") conteudo = <Aviso titulo="A pesquisa ainda não começou" texto="Volte a partir da data de início informada no convite." icone={CalendarClock} />;
  else if (c.estado === "usado") conteudo = <Aviso titulo="Este link já foi utilizado" texto="Cada convite permite uma única resposta. Obrigado pela participação." icone={CheckCircle2} />;
  else
    conteudo = (
      <FormularioNr1
        token={token}
        titulo={c.ciclo.titulo}
        descricao={c.ciclo.descricao}
        prazo={c.ciclo.encerraEm ? formatarData(c.ciclo.encerraEm) : null}
        privacidade={privacidadeNr1(c.org.minimo)}
        secoes={c.secoes}
        areas={c.areas}
        cor={cor}
      />
    );

  return (
    <div className="min-h-dvh bg-background">
      <header className="px-4 py-4 text-white" style={{ background: cor }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt={org?.nome ?? ""} className="max-h-8" /> : <span className="font-heading text-lg font-bold">{org?.nome ?? "Pesquisa"}</span>}
        </div>
      </header>
      <main id="conteudo" className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        {conteudo}
        <p className="text-center text-xs text-muted-foreground">Pesquisa conduzida com JourneyLab. Não é avaliação de saúde nem de desempenho.</p>
      </main>
    </div>
  );
}
