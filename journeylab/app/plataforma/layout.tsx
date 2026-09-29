import Link from "next/link";
import { exigirSuperadmin } from "@/lib/contexto";
import { sair } from "@/lib/auth/actions";
import { Logo } from "@/components/marca";
import { Abas } from "@/components/app/abas";

export default async function LayoutPlataforma({ children }: { children: React.ReactNode }) {
  const { usuario } = await exigirSuperadmin();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo href="/plataforma" claro />
            <span className="hidden rounded-full bg-sidebar-accent px-2.5 py-0.5 text-xs font-semibold text-sidebar-accent-foreground sm:inline">
              Administração
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {usuario.organizacoes.length > 0 && (
              <Link href="/organizacoes" className="hover:text-white">Minhas organizações</Link>
            )}
            <form action={sair}>
              <button type="submit" className="hover:text-white">Sair</button>
            </form>
          </div>
        </div>
      </header>
      <main id="conteudo" className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <Abas
            rotulo="Administração JourneyLab"
            abas={[
              { href: "/plataforma", rotulo: "Organizações", exato: true },
              { href: "/plataforma/usuarios", rotulo: "Usuários" },
              { href: "/plataforma/produtos", rotulo: "Produtos externos" },
              { href: "/plataforma/integracoes", rotulo: "Integrações" },
              { href: "/plataforma/auditoria", rotulo: "Auditoria" },
            ]}
          />
          {children}
        </div>
      </main>
    </div>
  );
}
