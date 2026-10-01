import { NextResponse } from "next/server";
import { transacao } from "@/lib/db";
import { baixarArquivo } from "@/lib/storage";
import { orgPublica } from "@/lib/carreiras/publico";
import { plataformaCarreiras } from "@/lib/carreiras/notificacao";

/**
 * Imagens da Página de Carreiras. O bucket continua privado: a rota só serve
 * imagens enviadas para a página DESTA organização (id + organização conferidos),
 * com o tipo gravado no upload. Currículos e demais anexos nunca passam por aqui.
 */
export async function GET(_: Request, { params }: { params: Promise<{ org: string; id: string }> }) {
  const { org: slug, id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(null, { status: 404 });
  const org = await orgPublica(slug);
  if (!org) return new NextResponse(null, { status: 404 });
  const m = await transacao(plataformaCarreiras, (tx) => tx.midiaCarreiras.findFirst({ where: { id, tenantId: org.id }, select: { caminho: true, mime: true } }));
  if (!m) return new NextResponse(null, { status: 404 });
  try {
    const arquivo = await baixarArquivo(m.caminho);
    return new NextResponse(arquivo.stream(), {
      headers: { "Content-Type": m.mime, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
