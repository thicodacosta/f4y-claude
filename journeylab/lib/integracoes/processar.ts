import "server-only";

import { transacao, type Tx } from "@/lib/db";
import { alterarEntitlement } from "@/lib/entitlements";
import { auditar } from "@/lib/auditoria";

/** Identidade técnica para ações automáticas (sem usuário humano). */
export const SISTEMA = "00000000-0000-0000-0000-000000000000";

export type TipoEvento = "aprovado" | "renovacao" | "reembolso" | "chargeback" | "cancelamento" | "outro";
export const TIPO_EVENTO: Record<TipoEvento, string> = {
  aprovado: "Compra aprovada",
  renovacao: "Renovação",
  reembolso: "Reembolso",
  chargeback: "Chargeback",
  cancelamento: "Cancelamento",
  outro: "Outro (sem efeito)",
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const txt = (...vs: unknown[]) => {
  for (const v of vs) if ((typeof v === "string" && v.trim()) || typeof v === "number") return String(v).trim();
  return null;
};
const digitos = (v: string | null) => (v ? v.replace(/\D/g, "") || null : null);

function tipoDe(bruto: string | null): TipoEvento {
  const t = (bruto ?? "").toLowerCase();
  if (/refund|reembols/.test(t)) return "reembolso";
  if (/charge.?back/.test(t)) return "chargeback";
  if (/cancel/.test(t)) return "cancelamento";
  if (/renew|renova/.test(t)) return "renovacao";
  if (/approved|aprovad|^paid$|order_paid|compra_aprovada/.test(t)) return "aprovado";
  return "outro";
}

/**
 * Normaliza o corpo do evento. Kiwify: aceita as variações de nomes de campo
 * mais comuns (order_id, webhook_event_type/order_status, Product, Customer).
 * Site: formato próprio e explícito { pedido_id, tipo, produto_id, email, documento }.
 * Não assume preço, plano nem prazo — isso vem do cadastro de produtos externos.
 */
export function interpretar(canal: "kiwify" | "site", corpo: unknown) {
  const c = obj(corpo);
  if (canal === "site") {
    return {
      tipo: tipoDe(txt(c.tipo)),
      pedidoId: txt(c.pedido_id),
      produtoIdExterno: txt(c.produto_id),
      compradorEmail: txt(c.email)?.toLowerCase() ?? null,
      compradorDocumento: digitos(txt(c.documento)),
    };
  }
  const produto = obj(c.Product ?? c.product);
  const cliente = obj(c.Customer ?? c.customer);
  const pedido = obj(c.order);
  return {
    tipo: tipoDe(txt(c.webhook_event_type, c.event, c.order_status, pedido.status)),
    pedidoId: txt(c.order_id, pedido.id, c.id),
    produtoIdExterno: txt(produto.product_id, produto.id, c.product_id),
    compradorEmail: txt(cliente.email, c.email)?.toLowerCase() ?? null,
    compradorDocumento: digitos(txt(cliente.CNPJ, cliente.cnpj, cliente.CPF, cliente.cpf, cliente.document, cliente.documento)),
  };
}

/** Organização pelos identificadores externos: e-mail do comprador, "@dominio" ou CNPJ/CPF. */
export async function identificarOrganizacao(tx: Tx, email: string | null, documento: string | null) {
  const chaves = new Set<string>();
  if (email) {
    chaves.add(email);
    chaves.add(`@${email.split("@")[1] ?? ""}`);
  }
  if (documento) chaves.add(documento);
  if (!chaves.size) return null;
  const orgs = await tx.organizacao.findMany({ where: { ativa: true, NOT: { identificadoresExternos: { isEmpty: true } } }, select: { id: true, identificadoresExternos: true } });
  const norm = (v: string) => (/^[\d.\-/ ]+$/.test(v) ? v.replace(/\D/g, "") : v.trim().toLowerCase());
  const achadas = orgs.filter((o) => o.identificadoresExternos.some((i) => chaves.has(norm(i))));
  return achadas.length === 1 ? achadas[0].id : null; // ambíguo = revisão manual
}

type Responsavel = { id: string; nome: string };

/**
 * Aplica o efeito do evento aos entitlements da organização — sempre pelo
 * serviço único (histórico com origem, pedido e responsável). Nunca apaga dados:
 * reembolso/chargeback/cancelamento SUSPENDEM apenas os módulos daquele pedido.
 */
export async function aplicar(tx: Tx, eventoId: string, organizacaoId: string, responsavel: Responsavel) {
  const e = await tx.eventoIntegracao.findUnique({ where: { id: eventoId } });
  if (!e) throw new Error("Evento não encontrado.");
  if (e.status === "processado") throw new Error("Evento já processado.");
  const tipo = (e.tipo ?? "outro") as TipoEvento;
  if (tipo === "outro") throw new Error("Este tipo de evento não altera acessos.");
  if (!e.pedidoId) throw new Error("Evento sem número de pedido.");
  const duplicado = await tx.eventoIntegracao.findFirst({ where: { id: { not: e.id }, canal: e.canal, pedidoId: e.pedidoId, tipo, status: "processado" } });
  if (duplicado) {
    await tx.eventoIntegracao.update({ where: { id: e.id }, data: { status: "ignorado", erro: "Evento duplicado: este pedido já foi processado com o mesmo tipo.", processadoEm: new Date() } });
    return "duplicado" as const;
  }
  const produto = e.produtoIdExterno ? await tx.produtoExterno.findUnique({ where: { canal_idExterno: { canal: e.canal, idExterno: e.produtoIdExterno } } }) : null;
  if (!produto || !produto.ativo) throw new Error("Produto externo não cadastrado ou inativo (Administração › Produtos externos).");
  const org = await tx.organizacao.findUnique({ where: { id: organizacaoId } });
  if (!org) throw new Error("Organização não encontrada.");

  const agora = new Date();
  const somaDias = (base: Date, dias: number) => new Date(base.getTime() + dias * 86_400_000);
  const motivo = `${TIPO_EVENTO[tipo]} · ${e.canal} · pedido ${e.pedidoId}`;
  const alterados: string[] = [];
  for (const modulo of produto.modulos) {
    const atual = await tx.entitlement.findUnique({ where: { tenantId_modulo: { tenantId: org.id, modulo } } });
    if (tipo === "aprovado") {
      await alterarEntitlement(tx, {
        tenantId: org.id, modulo, status: "ativo", inicio: agora,
        fim: produto.duracaoDias ? somaDias(agora, produto.duracaoDias) : null,
        origem: e.canal, referenciaExterna: e.pedidoId, responsavel, motivo,
      });
      alterados.push(modulo);
    } else if (tipo === "renovacao") {
      const base = atual?.fim && atual.fim > agora ? atual.fim : agora;
      await alterarEntitlement(tx, {
        tenantId: org.id, modulo, status: "ativo",
        fim: produto.duracaoDias ? somaDias(base, produto.duracaoDias) : null,
        origem: e.canal, referenciaExterna: e.pedidoId, responsavel, motivo,
      });
      alterados.push(modulo);
    } else if (atual && atual.referenciaExterna === e.pedidoId && atual.status !== "suspenso") {
      // Só suspende o que veio deste pedido; acessos manuais ou de outras compras ficam intactos.
      await alterarEntitlement(tx, { tenantId: org.id, modulo, status: "suspenso", origem: e.canal, responsavel, motivo });
      alterados.push(modulo);
    }
  }
  await tx.eventoIntegracao.update({
    where: { id: e.id },
    data: { status: "processado", organizacaoId: org.id, aplicadoPor: responsavel.nome, processadoEm: agora, erro: alterados.length ? null : "Nenhum módulo deste pedido estava ativo nesta organização." },
  });
  await auditar(tx, { tenantId: org.id, usuario: responsavel, acao: `integracao.${tipo}`, entidade: "evento_integracao", entidadeId: e.id, detalhes: { pedido: e.pedidoId, produto: produto.descricao, modulos: alterados } });
  return "aplicado" as const;
}

/**
 * Pós-recebimento: interpreta, identifica produto/organização e decide.
 * Ativação automática só com INTEGRACAO_ATIVACAO_AUTOMATICA=true, token
 * conferido e correspondência inequívoca; caso contrário, fica para revisão
 * do superadmin (padrão — contratação de empresas é manual).
 */
export async function processarRecebido(eventoId: string) {
  return transacao({ escopo: "plataforma", usuarioId: SISTEMA }, async (tx) => {
    const e = await tx.eventoIntegracao.findUnique({ where: { id: eventoId } });
    if (!e || e.status !== "recebido") return;
    const d = interpretar(e.canal, e.corpo);
    const organizacaoId = await identificarOrganizacao(tx, d.compradorEmail, d.compradorDocumento);
    const produto = d.produtoIdExterno ? await tx.produtoExterno.findUnique({ where: { canal_idExterno: { canal: e.canal, idExterno: d.produtoIdExterno } } }) : null;
    const pendencias = [
      d.tipo === "outro" && "tipo de evento sem efeito sobre acessos",
      !d.pedidoId && "sem número de pedido",
      !produto && "produto não cadastrado",
      !organizacaoId && "organização não identificada pelos identificadores externos",
    ].filter(Boolean) as string[];
    await tx.eventoIntegracao.update({
      where: { id: e.id },
      data: { ...d, organizacaoId, tentativas: { increment: 1 }, status: d.tipo === "outro" ? "ignorado" : "recebido", erro: pendencias.length ? `Aguardando revisão: ${pendencias.join("; ")}.` : "Aguardando revisão do superadmin." },
    });
    const automatica = process.env.INTEGRACAO_ATIVACAO_AUTOMATICA === "true";
    if (automatica && e.tokenConferido && !pendencias.length && organizacaoId) {
      await aplicar(tx, e.id, organizacaoId, { id: SISTEMA, nome: `Integração ${e.canal}` });
    }
  });
}
