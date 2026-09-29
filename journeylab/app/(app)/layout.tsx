import { cookies } from "next/headers";
import { AppShell } from "@/components/app/app-shell";
import { exigirContexto, pode } from "@/lib/contexto";
import { MODULOS } from "@/lib/permissoes";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const ctx = await exigirContexto();
  // Menu: só módulos contratados E com permissão de visualizar (a checagem real ocorre de novo em cada página/ação).
  const modulos = MODULOS.filter((m) => ctx.modulos.has(m.chave) && (pode(ctx, m.chave, "visualizar") || m.chave === "pulse")).map((m) => ({
    chave: m.chave,
    nome: m.nome,
  }));
  const recolhido = (await cookies()).get("jl_menu_recolhido")?.value === "1";
  return (
    <AppShell
      recolhidoInicial={recolhido}
      dados={{
        usuario: { nome: ctx.usuario.nome, email: ctx.usuario.email, superadmin: ctx.usuario.superadmin },
        org: { id: ctx.org.id, nome: ctx.org.nome },
        papel: ctx.papel.nome,
        organizacoes: ctx.usuario.organizacoes,
        modulos,
        cadastro: !!pode(ctx, "cadastro", "visualizar") && pode(ctx, "cadastro", "visualizar") !== "proprio",
        configuracoes: !!pode(ctx, "organizacao", "visualizar"),
        suporte: ctx.suporte ? { expiraEm: ctx.suporte.expiraEm.toISOString() } : null,
      }}
    >
      {children}
    </AppShell>
  );
}
