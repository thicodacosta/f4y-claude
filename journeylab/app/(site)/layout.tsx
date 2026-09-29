import Link from "next/link";
import { Logo } from "@/components/marca";

/** Telas fora da área logada: login, recuperação, aceite, escolha de organização, documentos legais. */
export default function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 sm:px-6">
          <Logo href="/inicio" />
        </div>
      </header>
      <main id="conteudo" className="flex flex-1 flex-col">
        {children}
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-5 gap-y-1 px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <span>© {new Date().getFullYear()} JourneyLab</span>
          <Link href="/termos" className="hover:text-foreground">Termos de uso</Link>
          <Link href="/privacidade" className="hover:text-foreground">Política de privacidade</Link>
        </div>
      </footer>
    </div>
  );
}
