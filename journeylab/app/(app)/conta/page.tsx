import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { exigirContexto } from "@/lib/contexto";
import { dbUsuario } from "@/lib/db";
import { formatarData } from "@/lib/formato";
import { CabecalhoPagina } from "@/components/secao";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Minha conta" };

export default async function ContaPage() {
  const ctx = await exigirContexto();
  const consentimentos = await dbUsuario(ctx.usuario.id).consentimento.findMany({
    where: { usuarioId: ctx.usuario.id },
    orderBy: { registradoEm: "desc" },
  });

  return (
    <>
      <CabecalhoPagina titulo="Minha conta" descricao="Seus dados de acesso, organizações e consentimentos." />
      <section className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Nome</p>
          <p className="font-medium">{ctx.usuario.nome}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">E-mail</p>
          <p className="font-medium">{ctx.usuario.email}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground">Organizações</p>
          <p className="font-medium">{ctx.usuario.organizacoes.map((o) => o.nome).join(", ") || "—"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Papel em {ctx.org.nome}: {ctx.papel.nome}</p>
        </div>
      </section>
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-bold">Privacidade</h2>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {consentimentos.map((c) => (
            <li key={c.id}>
              {c.tipo === "termos" ? "Termos de uso" : "Política de privacidade"} · versão {c.versao} · {c.aceito ? "aceito" : "recusado"} em {formatarData(c.registradoEm)}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Os dados que você registra nos produtos pertencem à sua organização. Pedidos de acesso, correção ou exclusão
          desses dados são tratados com o administrador da organização. Veja a{" "}
          <Link href="/privacidade" className="underline underline-offset-2">Política de privacidade</Link>.
        </p>
        <a href="/conta/exportar" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-fit px-4")}>
          <Download data-icon="inline-start" /> Exportar dados da minha conta
        </a>
      </section>
    </>
  );
}
