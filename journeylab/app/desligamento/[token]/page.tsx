import type { Metadata } from "next";
import { CheckCircle2, Clock, Lock } from "lucide-react";
import { carregarEntrevistaPublica } from "@/lib/offboarding/publico";
import { FormularioEntrevista } from "@/components/offboarding/formulario-entrevista";

export const metadata: Metadata = { title: "Entrevista de desligamento", robots: { index: false, follow: false } };
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
 * Entrevista de desligamento (pública, sem login). O link é assinado, de uso
 * único e expira; reenviar o convite invalida o link anterior. Nenhum dado além
 * do primeiro nome e da organização chega ao navegador.
 */
export default async function EntrevistaDesligamento({ params }: { params: Promise<{ token: string }> }) {
  const { token: bruto } = await params;
  const token = decodeURIComponent(bruto);
  const c = await carregarEntrevistaPublica(token);
  const org = c.estado === "invalido" ? null : c.org;
  const cor = org?.corMarca && /^#[0-9a-fA-F]{6}$/.test(org.corMarca) ? org.corMarca : "#0B1F3A";
  const logo = org?.logoUrl && /^https:\/\//.test(org.logoUrl) ? org.logoUrl : null;

  let conteudo: React.ReactNode;
  if (c.estado === "invalido") conteudo = <Aviso titulo="Link inválido" texto="Este link não é válido ou foi substituído por um envio mais recente. Use o último link recebido por e-mail." />;
  else if (c.estado === "respondida") conteudo = <Aviso titulo="Entrevista já respondida" texto="Recebemos suas respostas. Obrigado pela contribuição." icone={CheckCircle2} />;
  else if (c.estado === "expirada") conteudo = <Aviso titulo="Prazo encerrado" texto="O prazo para responder esta entrevista terminou. Se ainda quiser contribuir, fale com o RH da empresa." icone={Clock} />;
  else
    conteudo = (
      <>
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6 shadow-surface">
          <h1 className="font-heading text-2xl font-bold">Olá, {c.primeiroNome}. Obrigado pelo tempo com a gente.</h1>
          <p className="text-sm text-muted-foreground">
            Queremos entender, com franqueza, o que levou à sua saída e o que {c.org.nome} pode melhorar. São cerca de 5 minutos.
          </p>
          <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            As respostas são lidas apenas pela equipe de RH, de forma confidencial — não são compartilhadas com a sua liderança direta — e usadas em análises agregadas para melhorar a experiência de quem fica.
          </p>
        </section>
        <FormularioEntrevista modo="publico" token={token} cor={cor} />
      </>
    );

  return (
    <div className="min-h-dvh bg-background">
      <header className="px-4 py-4 text-white" style={{ background: cor }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt={org?.nome ?? ""} className="max-h-8" /> : <span className="font-heading text-lg font-bold">{org?.nome ?? "Entrevista de desligamento"}</span>}
        </div>
      </header>
      <main id="conteudo" className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        {conteudo}
        <p className="text-center text-xs text-muted-foreground">Entrevista conduzida com JourneyLab.</p>
      </main>
    </div>
  );
}
