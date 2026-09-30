import type { Metadata } from "next";
import { CalendarClock, Lock } from "lucide-react";
import { carregarParaResponder } from "@/lib/pulse/publico";
import { formatarData } from "@/lib/formato";
import { FormularioResposta } from "@/components/pulse/formulario-resposta";

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
 * Página pública de resposta (sem login obrigatório). Identidade: link pessoal
 * do e-mail, sessão de alguém da organização, ou link aberto (se habilitado).
 * Nunca mostra resultados nem dados de outras pesquisas.
 */
export default async function ResponderPesquisa({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const token = sp.t ?? null;
  const c = await carregarParaResponder(id, token);
  const cor = c?.org.corMarca && /^#[0-9a-fA-F]{6}$/.test(c.org.corMarca) ? c.org.corMarca : "#0B1F3A";
  const logo = c?.org.logoUrl && /^https:\/\//.test(c.org.logoUrl) ? c.org.logoUrl : null;

  let conteudo: React.ReactNode;
  if (!c) conteudo = <Aviso titulo="Pesquisa não encontrada" texto="O link pode estar incorreto ou a pesquisa não está mais disponível." />;
  else if (c.situacao === "encerrada") conteudo = <Aviso titulo="Pesquisa encerrada" texto="Esta pesquisa não recebe mais respostas. Obrigado pelo interesse." />;
  else if (c.situacao === "nao_iniciada") conteudo = <Aviso titulo="A pesquisa ainda não começou" texto="Volte a partir da data de início informada no convite." icone={CalendarClock} />;
  else if (c.jaRespondeu) conteudo = <Aviso titulo="Você já respondeu esta pesquisa" texto="Recebemos sua participação. Obrigado!" />;
  else if (c.respondente.modo === "negado")
    conteudo = (
      <Aviso
        titulo={c.naAudiencia ? "Use o seu link pessoal" : "Pesquisa para outro público"}
        texto={c.naAudiencia ? "Esta pesquisa é respondida pelo link pessoal enviado por e-mail. Abra o convite e clique em “Responder Pesquisa”." : "Você não faz parte do público desta pesquisa."}
      />
    );
  else
    conteudo = (
      <FormularioResposta
        pesquisaId={c.pesquisa.id}
        token={token}
        titulo={c.pesquisa.titulo}
        descricao={c.pesquisa.descricao}
        anonima={c.pesquisa.anonima}
        nome={c.respondente.nome}
        perguntas={c.perguntas}
        cor={cor}
      />
    );

  return (
    <div className="min-h-dvh bg-background">
      <header className="px-4 py-4 text-white" style={{ background: cor }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt={c?.org.nome ?? ""} className="max-h-8" /> : <span className="font-heading text-lg font-bold">{c?.org.nome ?? "Pesquisa"}</span>}
          {c?.pesquisa.encerraEm && c.situacao === "ativa" && <span className="text-xs opacity-80">Até {formatarData(c.pesquisa.encerraEm)}</span>}
        </div>
      </header>
      <main id="conteudo" className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        {conteudo}
        <p className="text-center text-xs text-muted-foreground">Pesquisa conduzida com JourneyLab.</p>
      </main>
    </div>
  );
}
