import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUsuario } from "@/lib/auth";
import { PortalShell } from "@/components/portal-shell";

export default async function PortalClienteLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getSessionUsuario();
  if (!usuario) redirect("/portal-login");
  // Papel diferente (interno ou candidato_portal) — não é deste portal, cada
  // um tem seu ponto de entrada correto (ver app/(app)/layout.tsx e
  // app/(portal-candidato)/layout.tsx).
  if (usuario.papel !== "cliente_portal") redirect("/dashboard");

  return (
    <PortalShell
      titulo="Portal do Cliente"
      nome={usuario.nome}
      email={usuario.email}
      nav={
        <Link href="/portal-cliente/vagas" className="font-medium hover:underline">
          Vagas
        </Link>
      }
    >
      {children}
    </PortalShell>
  );
}
