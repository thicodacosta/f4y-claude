import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUsuario } from "@/lib/auth";
import { PortalShell } from "@/components/portal-shell";

export default async function PortalCandidatoLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getSessionUsuario();
  if (!usuario) redirect("/portal-login");
  if (usuario.papel !== "candidato_portal") redirect("/dashboard");

  return (
    <PortalShell
      titulo="Portal do Candidato"
      nome={usuario.nome}
      email={usuario.email}
      nav={
        <>
          <Link href="/portal-candidato/processo" className="font-medium hover:underline">
            Meu processo
          </Link>
          <Link href="/portal-candidato/perfil" className="font-medium hover:underline">
            Meu perfil
          </Link>
        </>
      }
    >
      {children}
    </PortalShell>
  );
}
