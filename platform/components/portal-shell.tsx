import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

/**
 * Shell dos portais externos (cliente/candidato) — deliberadamente sem
 * sidebar nem os itens de navegação interna do AppShell: quem está aqui não
 * é um usuário da Find4You, só vê o próprio subconjunto de dados via
 * `nav` (links passados pela página, não um menu configurável por papel).
 */
export function PortalShell({
  titulo,
  nome,
  email,
  nav,
  children,
}: {
  titulo: string;
  nome: string;
  email: string;
  nav?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-white p-1">
            <Image src="/logo-monogram.png" alt="Find4You" width={28} height={28} />
          </div>
          <span className="font-heading text-sm font-semibold">{titulo}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu nome={nome} email={email} logoutRedirectTo="/portal-login" />
        </div>
      </header>
      {nav && (
        <nav className="flex gap-4 border-b border-border bg-background px-4 py-2 text-sm sm:px-6">{nav}</nav>
      )}
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
