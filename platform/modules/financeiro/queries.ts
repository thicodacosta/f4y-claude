import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_FINANCEIRO } from "@/lib/roles";

function inicioDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getKpisFinanceiro() {
  await requirePapel(PAPEIS_FINANCEIRO);
  const desde = inicioDoMes();

  const [pendente, faturadoMes, pagoMes, comissoesPendentes, comissoesAprovadas] = await Promise.all([
    prisma.faturamento.aggregate({ where: { status: "pendente" }, _sum: { valor: true }, _count: true }),
    prisma.faturamento.aggregate({
      where: { status: { in: ["faturado", "pago"] }, criadoEm: { gte: desde } },
      _sum: { valor: true },
    }),
    prisma.faturamento.aggregate({ where: { status: "pago", criadoEm: { gte: desde } }, _sum: { valor: true } }),
    prisma.comissao.aggregate({ where: { status: "pendente" }, _sum: { valor: true }, _count: true }),
    prisma.comissao.aggregate({ where: { status: "aprovada" }, _sum: { valor: true }, _count: true }),
  ]);

  return {
    faturamentoPendente: Number(pendente._sum.valor ?? 0),
    faturamentoPendenteCount: pendente._count,
    faturadoNoMes: Number(faturadoMes._sum.valor ?? 0),
    pagoNoMes: Number(pagoMes._sum.valor ?? 0),
    comissoesPendentes: Number(comissoesPendentes._sum.valor ?? 0),
    comissoesPendentesCount: comissoesPendentes._count,
    comissoesAprovadas: Number(comissoesAprovadas._sum.valor ?? 0),
    comissoesAprovadasCount: comissoesAprovadas._count,
  };
}

async function descreverOrigens(itens: { origemTipo: string; origemId: string }[]) {
  const idsOportunidade = itens.filter((i) => i.origemTipo === "oportunidade").map((i) => i.origemId);
  const idsVaga = itens.filter((i) => i.origemTipo === "vaga").map((i) => i.origemId);

  const [oportunidades, vagas] = await Promise.all([
    idsOportunidade.length
      ? prisma.oportunidade.findMany({ where: { id: { in: idsOportunidade } }, include: { empresa: true } })
      : [],
    idsVaga.length ? prisma.vaga.findMany({ where: { id: { in: idsVaga } }, include: { empresa: true } }) : [],
  ]);

  const descricoes = new Map<string, string>();
  for (const o of oportunidades) descricoes.set(o.id, `Oportunidade — ${o.empresa.nome}`);
  for (const v of vagas) descricoes.set(v.id, `Vaga — ${v.cargo} (${v.empresa.nome})`);
  return descricoes;
}

export async function getFaturamentos() {
  await requirePapel(PAPEIS_FINANCEIRO);

  const faturamentos = await prisma.faturamento.findMany({
    include: { empresa: true },
    orderBy: { criadoEm: "desc" },
  });
  const descricoes = await descreverOrigens(faturamentos);

  const idsContatoNf = [...new Set(faturamentos.flatMap((f) => f.contatosNfIds))];
  const contatos = idsContatoNf.length
    ? await prisma.contato.findMany({ where: { id: { in: idsContatoNf } }, select: { id: true, nome: true } })
    : [];
  const nomeDoContato = new Map(contatos.map((c) => [c.id, c.nome]));

  return faturamentos.map((f) => ({
    id: f.id,
    empresaNome: f.empresa.nome,
    origem: descricoes.get(f.origemId) ?? f.origemTipo,
    valor: Number(f.valor),
    status: f.status,
    dataPrevista: f.dataPrevista ? f.dataPrevista.toISOString() : null,
    dataEfetiva: f.dataEfetiva ? f.dataEfetiva.toISOString() : null,
    dataInicio: f.dataInicio ? f.dataInicio.toISOString() : null,
    contatosNf: f.contatosNfIds.map((id) => nomeDoContato.get(id) ?? "—"),
    dataEmissaoNf: f.dataEmissaoNf ? f.dataEmissaoNf.toISOString() : null,
    nfEmitida: f.nfEmitida,
    dataInicioProfissional: f.dataInicioProfissional ? f.dataInicioProfissional.toISOString() : null,
    dataTerminoAlocacao: f.dataTerminoAlocacao ? f.dataTerminoAlocacao.toISOString() : null,
    alocacaoEncerrada: f.alocacaoEncerrada,
    criadoEm: f.criadoEm.toISOString(),
  }));
}

export async function getComissoes() {
  await requirePapel(PAPEIS_FINANCEIRO);

  const comissoes = await prisma.comissao.findMany({
    include: { usuario: true },
    orderBy: { criadoEm: "desc" },
  });
  const descricoes = await descreverOrigens(comissoes);

  return comissoes.map((c) => ({
    id: c.id,
    usuarioNome: c.usuario.nome,
    origem: descricoes.get(c.origemId) ?? c.origemTipo,
    valor: Number(c.valor),
    percentual: Number(c.percentual),
    status: c.status,
    competencia: c.competencia,
    criadoEm: c.criadoEm.toISOString(),
  }));
}

export async function getRegrasComissao() {
  await requirePapel(PAPEIS_FINANCEIRO);

  const regras = await prisma.regraComissao.findMany({ orderBy: { vertical: "asc" } });
  return regras.map((r) => ({
    id: r.id,
    vertical: r.vertical,
    percentualConsultor: Number(r.percentualConsultor),
    percentualRecrutador: Number(r.percentualRecrutador),
  }));
}
