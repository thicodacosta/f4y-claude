import Link from "next/link";
import { notFound } from "next/navigation";
import { orgPublica } from "@/lib/carreiras/publico";

/**
 * Página de Carreiras pública: barra com a identidade da empresa (logo ou nome),
 * atalhos para as seções e rodapé com a política de privacidade. As seções da
 * página controlam a própria largura (capa em largura total).
 */
export default async function LayoutCarreirasPublico({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const org = await orgPublica(slug);
  if (!org) notFound();
  const logo = org.logoUrl && /^https:\/\//.test(org.logoUrl) ? org.logoUrl : null;
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={`/carreiras/${org.slug}`} className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt={org.nome} className="max-h-9 max-w-40 object-contain" /> : <span className="truncate font-heading text-lg font-bold">{org.nome}</span>}
          </Link>
          <nav aria-label="Seções" className="flex items-center gap-1 text-sm font-medium">
            <Link href={`/carreiras/${org.slug}#sobre`} className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              Sobre
            </Link>
            <Link href={`/carreiras/${org.slug}#vagas`} className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              Vagas
            </Link>
          </nav>
        </div>
      </header>
      <main id="conteudo" className="flex flex-1 flex-col">
        {children}
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-5 gap-y-1 px-4 py-5 text-xs text-muted-foreground sm:px-6">
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
