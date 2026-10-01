import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirModulo, pode } from "@/lib/contexto";
import { lerConteudo } from "@/lib/carreiras/pagina";
import { EditorPaginaCarreiras } from "@/components/carreiras/editor-pagina";

export const metadata: Metadata = { title: "Configurações · Página de Carreiras" };

/** Conteúdo da página pública: capa, sobre, blocos de texto e imagem, benefícios, depoimentos, galeria e links. */
export default async function ConfiguracoesPagina() {
  const { ctx, db } = await exigirModulo("crm");
  if (pode(ctx, "crm", "editar") !== "todos" || ctx.suporte) redirect("/pagina-carreiras");
  const [org, pagina, vagas] = await Promise.all([
    db.organizacao.findUnique({ where: { id: ctx.org.id }, select: { slug: true, logoUrl: true, corMarca: true } }),
    db.paginaCarreiras.findUnique({ where: { tenantId: ctx.org.id } }),
    db.vaga.findMany({ where: { publicada: true, status: "aberta" }, select: { slug: true, titulo: true }, orderBy: { titulo: "asc" } }),
  ]);
  return (
    <section aria-labelledby="titulo" className="flex flex-col gap-4">
      <div>
        <h2 id="titulo" className="font-heading text-lg font-bold">
          Configurações da página
        </h2>
        <p className="text-sm text-muted-foreground">
          Monte a página pública com imagens e textos da empresa. Logo e cor vêm do cadastro da organização{org?.logoUrl || org?.corMarca ? "" : " (ainda não definidos — o padrão do JourneyLab é usado)"}.
        </p>
      </div>
      <EditorPaginaCarreiras inicial={lerConteudo(pagina?.conteudo)} base={`/carreiras/${org?.slug ?? ""}`} vagas={vagas} />
    </section>
  );
}
