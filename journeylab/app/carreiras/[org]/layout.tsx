import Link from "next/link";
import { notFound } from "next/navigation";
import { orgPublica } from "@/lib/carreiras/publico";

/** Página de Carreiras pública: identidade da empresa (nome, logo, cor) e rodapé com a política de privacidade. */
export default async function LayoutCarreirasPublico({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const org = await orgPublica(slug);
  if (!org) notFound();
  const cor = org.corMarca && /^#[0-9a-fA-F]{6}$/.test(org.corMarca) ? org.corMarca : "#0B1F3A";
  const logo = org.logoUrl && /^https:\/\//.test(org.logoUrl) ? org.logoUrl : null;
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="text-white" style={{ background: cor }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href={`/carreiras/${org.slug}`} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt={org.nome} className="max-h-9" /> : <span className="font-heading text-lg font-bold">{org.nome}</span>}
          </Link>
          <span className="text-sm opacity-85">Carreiras</span>
        </div>
      </header>
      <main id="conteudo" className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap gap-x-5 gap-y-1 px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <span>Página de carreiras de {org.nome} · JourneyLab</span>
          <Link href="/privacidade" className="hover:text-foreground">
            Política de privacidade
          </Link>
          <Link href="/termos" className="hover:text-foreground">
            Termos de uso
          </Link>
        </div>
      </footer>
    </div>
  );
}
