"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transacao } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { enviarArquivo, removerArquivo, tipoRealImagem } from "@/lib/storage";
import { conteudoSchema, imagensUsadas, TAMANHO_IMAGEM, TIPOS_IMAGEM } from "./pagina";

const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });

function erroDe(e: unknown) {
  if (e instanceof z.ZodError) {
    const i = e.issues[0];
    return { erro: `${i.message}${i.path.length ? ` (${i.path.join(" › ")})` : ""}` };
  }
  return { erro: e instanceof Error && !/prisma|invocation/i.test(e.message) ? e.message : "Não foi possível salvar. Tente novamente." };
}

/** Configurações da página: quem edita vagas no CRM edita a página (escopo "todos"). */
async function exigirEdicao() {
  const r = await exigirPermissaoAcao("crm", "editar");
  if (r.escopo !== "todos") throw new ErroAcesso("Seu papel não permite editar a Página de Carreiras.");
  return r;
}

/** Salva o conteúdo; toda imagem referenciada precisa ser desta organização. */
export async function salvarPaginaCarreiras(conteudoJson: string): Promise<{ ok?: string; erro?: string }> {
  try {
    const { ctx } = await exigirEdicao();
    const c = conteudoSchema.parse(JSON.parse(conteudoJson));
    await transacao(escopoTx(ctx), async (tx) => {
      const ids = [...new Set(imagensUsadas(c))];
      if (ids.length && (await tx.midiaCarreiras.count({ where: { id: { in: ids } } })) !== ids.length) throw new ErroAcesso("Há imagens que não pertencem a esta organização.");
      await tx.paginaCarreiras.upsert({
        where: { tenantId: ctx.org.id },
        update: { conteudo: c, atualizadoPor: ctx.usuario.nome },
        create: { tenantId: ctx.org.id, conteudo: c, atualizadoPor: ctx.usuario.nome },
      });
      await auditar(tx, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "carreiras.pagina.salvar", entidade: "pagina_carreiras", entidadeId: ctx.org.id });
    });
    revalidatePath("/pagina-carreiras/configuracoes");
    return { ok: "Página de carreiras atualizada." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Envio de imagem (JPG, PNG ou WebP até 5 MB, conferida pela assinatura) para o bucket privado. */
export async function enviarImagemCarreiras(fd: FormData): Promise<{ id?: string; erro?: string }> {
  try {
    const { ctx } = await exigirEdicao();
    const arquivo = fd.get("imagem");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Selecione uma imagem." };
    if (arquivo.size > TAMANHO_IMAGEM) return { erro: "A imagem deve ter no máximo 5 MB." };
    const mime = await tipoRealImagem(arquivo);
    if (!mime || !TIPOS_IMAGEM[mime]) return { erro: "Formato não aceito. Envie JPG, PNG ou WebP." };
    const caminho = await enviarArquivo(ctx.org.id, "carreiras/midia", arquivo);
    try {
      const m = await transacao(escopoTx(ctx), (tx) =>
        tx.midiaCarreiras.create({ data: { tenantId: ctx.org.id, caminho, nomeArquivo: arquivo.name.slice(0, 200), mime, tamanho: arquivo.size, enviadoPor: ctx.usuario.nome } }),
      );
      return { id: m.id };
    } catch (e) {
      await removerArquivo(caminho).catch(() => undefined);
      throw e;
    }
  } catch (e) {
    return erroDe(e);
  }
}
