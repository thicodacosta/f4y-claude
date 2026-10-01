"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transacao } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { dataDeTexto } from "@/lib/datas";
import { lerCsv, mapearLinhas, normalizarDataBr, normalizarSituacao } from "./importacao";

export type ResultadoImportacao = { ok?: string; erro?: string; criados?: number; atualizados?: number; erros?: { linha: number; motivo: string }[]; ignoradas?: string[] };

const LIMITE_LINHAS = 2000;

/**
 * Importa a base de colaboradores (RH/Admin: cadastro › criar e editar, escopo "todos").
 * Chave: e-mail (atualiza quem já existe; sem e-mail sempre cria). Equipes e áreas
 * inexistentes são criadas; gestor resolvido pelo e-mail (na base ou no próprio arquivo).
 * Tudo numa transação — se algo inesperado falhar, nada é gravado. Não cria
 * onboarding automático (use o cadastro individual ou o Onboarding).
 */
export async function importarColaboradores(fd: FormData): Promise<ResultadoImportacao> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("cadastro", "criar");
    const ed = await exigirPermissaoAcao("cadastro", "editar");
    if (escopo !== "todos" || ed.escopo !== "todos") throw new ErroAcesso("Seu papel não permite importar a base de colaboradores.");
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) throw new ErroAcesso("Escolha um arquivo CSV.");
    if (arquivo.size > 2 * 1024 * 1024) throw new ErroAcesso("Arquivo acima de 2 MB.");
    const { linhas, colunas, ignoradas } = mapearLinhas(lerCsv(await arquivo.text()));
    if (!colunas.includes("nome")) throw new ErroAcesso("O arquivo precisa da coluna “nome” no cabeçalho.");
    if (!linhas.length) throw new ErroAcesso("Nenhuma linha de dados encontrada.");
    if (linhas.length > LIMITE_LINHAS) throw new ErroAcesso(`Máximo de ${LIMITE_LINHAS} linhas por importação.`);

    const erros: { linha: number; motivo: string }[] = [];
    const validas: { n: number; nome: string; email: string | null; cargo: string | null; equipe: string | null; area: string | null; gestorEmail: string | null; admissao: string | null; situacao: "ativo" | "pre_admissao" | "desligado" }[] = [];
    const vistos = new Set<string>();
    linhas.forEach((l, i) => {
      const n = i + 2; // linha 1 = cabeçalho
      const nome = (l.nome ?? "").slice(0, 160);
      if (nome.length < 2) return erros.push({ linha: n, motivo: "Nome ausente." });
      const email = l.email ? l.email.toLowerCase() : null;
      if (email && !z.string().email().safeParse(email).success) return erros.push({ linha: n, motivo: `E-mail inválido: ${email}` });
      if (email && vistos.has(email)) return erros.push({ linha: n, motivo: `E-mail repetido no arquivo: ${email}` });
      if (email) vistos.add(email);
      const admissao = l.data_admissao ? normalizarDataBr(l.data_admissao) : null;
      if (l.data_admissao && !admissao) return erros.push({ linha: n, motivo: `Data de admissão inválida: ${l.data_admissao} (use AAAA-MM-DD ou DD/MM/AAAA)` });
      const situacao = normalizarSituacao(l.situacao);
      if (!situacao) return erros.push({ linha: n, motivo: `Situação desconhecida: ${l.situacao} (use ativo, pré-admissão ou desligado)` });
      const gestorEmail = l.gestor_email ? l.gestor_email.toLowerCase() : null;
      if (gestorEmail && !z.string().email().safeParse(gestorEmail).success) return erros.push({ linha: n, motivo: `E-mail do gestor inválido: ${gestorEmail}` });
      validas.push({ n, nome, email, cargo: l.cargo?.slice(0, 120) ?? null, equipe: l.equipe?.slice(0, 120) ?? null, area: l.area?.slice(0, 120) ?? null, gestorEmail, admissao, situacao });
    });

    const r = await transacao({ escopo: "tenant", tenantId: ctx.org.id, usuarioId: ctx.usuario.id }, async (tx) => {
      let criados = 0;
      let atualizados = 0;
      const areas = new Map((await tx.area.findMany({ select: { id: true, nome: true } })).map((a) => [a.nome.toLowerCase(), a.id]));
      const equipes = new Map((await tx.equipe.findMany({ select: { id: true, nome: true } })).map((e) => [e.nome.toLowerCase(), e.id]));
      const idPorEmail = new Map<string, string>();
      for (const v of validas) {
        let areaId: string | null = null;
        if (v.area) {
          areaId = areas.get(v.area.toLowerCase()) ?? null;
          if (!areaId) {
            areaId = (await tx.area.create({ data: { tenantId: ctx.org.id, nome: v.area } })).id;
            areas.set(v.area.toLowerCase(), areaId);
          }
        }
        let equipeId: string | null = null;
        if (v.equipe) {
          equipeId = equipes.get(v.equipe.toLowerCase()) ?? null;
          if (!equipeId) {
            equipeId = (await tx.equipe.create({ data: { tenantId: ctx.org.id, nome: v.equipe, areaId } })).id;
            equipes.set(v.equipe.toLowerCase(), equipeId);
          }
        }
        const dados = {
          nome: v.nome,
          cargo: v.cargo,
          ...(equipeId ? { equipeId } : {}),
          dataAdmissao: v.admissao ? dataDeTexto(v.admissao) : undefined,
          status: v.situacao,
        };
        const existente = v.email ? await tx.colaborador.findUnique({ where: { tenantId_email: { tenantId: ctx.org.id, email: v.email } } }) : null;
        if (existente) {
          await tx.colaborador.update({
            where: { id: existente.id },
            data: { ...dados, desligadoEm: v.situacao === "desligado" ? (existente.desligadoEm ?? new Date()) : null },
          });
          idPorEmail.set(v.email!, existente.id);
          atualizados++;
        } else {
          const c = await tx.colaborador.create({ data: { ...dados, tenantId: ctx.org.id, email: v.email, desligadoEm: v.situacao === "desligado" ? new Date() : null } });
          if (v.email) idPorEmail.set(v.email, c.id);
          criados++;
        }
      }
      // Gestores depois de todos gravados: podem estar no próprio arquivo.
      for (const v of validas) {
        if (!v.gestorEmail || !v.email) continue;
        const id = idPorEmail.get(v.email)!;
        const gestorId = idPorEmail.get(v.gestorEmail) ?? (await tx.colaborador.findUnique({ where: { tenantId_email: { tenantId: ctx.org.id, email: v.gestorEmail } }, select: { id: true } }))?.id;
        if (!gestorId) erros.push({ linha: v.n, motivo: `Gestor não encontrado: ${v.gestorEmail} (pessoa importada sem gestor)` });
        else if (gestorId === id) erros.push({ linha: v.n, motivo: "A pessoa não pode ser gestora de si mesma." });
        else await tx.colaborador.update({ where: { id }, data: { gestorId } });
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "colaborador.importar", entidade: "colaborador", detalhes: { arquivo: arquivo.name, criados, atualizados, erros: erros.length } });
      return { criados, atualizados };
    });
    revalidatePath("/colaboradores");
    revalidatePath("/equipes");
    return {
      ok: `Importação concluída: ${r.criados} criado(s) e ${r.atualizados} atualizado(s)${erros.length ? `; ${erros.length} linha(s) com problema` : ""}.`,
      ...r,
      erros: erros.sort((a, b) => a.linha - b.linha).slice(0, 200),
      ignoradas,
    };
  } catch (e) {
    return { erro: e instanceof ErroAcesso ? e.message : "Não foi possível importar o arquivo. Confira o formato e tente novamente." };
  }
}
