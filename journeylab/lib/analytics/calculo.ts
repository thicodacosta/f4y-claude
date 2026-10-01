/**
 * People Analytics — fórmulas ÚNICAS (Retenção, People Analytics, exportação e
 * painel). Puras: servidor e cliente. Datas civis em 00:00 UTC (lib/datas.ts).
 *
 *  Headcount em D        pessoas com admissão ≤ D e sem saída até D (pré-admissão não entra)
 *  Headcount médio       (headcount no início + headcount no fim) ÷ 2
 *  Turnover (saídas)     saídas no período ÷ headcount médio × 100
 *  Anualizado            turnover × 365 ÷ dias do período
 *  Rotatividade geral    ((admissões + saídas) ÷ 2) ÷ headcount médio × 100 (fórmula clássica usada no Brasil)
 *  Retenção 12 meses     das pessoas ativas há 12 meses, % que seguem ativas hoje
 *  Saída precoce         saídas com menos de 90 dias de casa (% das saídas)
 */

const DIA = 86_400_000;

export type Pessoa = { id: string; admissao: Date; saida: Date | null; areaId: string | null; equipeId: string | null; gestorId: string | null };
export type Saida = {
  colaboradorId: string;
  data: Date;
  /** null = desligamento sem registro no Offboarding (só a data no cadastro). */
  voluntario: boolean | null;
  perdaLamentada: boolean;
  admissao: Date | null;
  areaId: string | null;
  areaNome: string | null;
  gestorId: string | null;
  gestorNome: string | null;
  motivoDeclarado: string | null;
  motivosReais: string[];
  motivoPrincipalReal: string | null;
  enps: number | null;
  evitavel: string | null;
  entrevistaStatus: string | null;
  experiencia: Record<string, number> | null;
};

export const PERIODOS = {
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "6m": "Últimos 6 meses",
  "12m": "Últimos 12 meses",
  ano: "Ano atual",
  personalizado: "Personalizado",
} as const;
export type ChavePeriodo = keyof typeof PERIODOS;

export type Periodo = { chave: ChavePeriodo; inicio: Date; fim: Date; dias: number; rotulo: string; anterior: { inicio: Date; fim: Date } };

const textoData = (d: Date) => d.toISOString().slice(0, 10);
const dataValida = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) ? new Date(`${s}T00:00:00Z`) : null);

/** Período a partir da URL (?periodo=…&de=…&ate=…); padrão: últimos 12 meses. */
export function resolverPeriodo(sp: { periodo?: string; de?: string; ate?: string }, hoje: Date): Periodo {
  const chave: ChavePeriodo = sp.periodo && sp.periodo in PERIODOS ? (sp.periodo as ChavePeriodo) : "12m";
  let fim = hoje;
  let inicio: Date;
  if (chave === "personalizado") {
    const de = dataValida(sp.de);
    const ate = dataValida(sp.ate);
    fim = ate && ate <= hoje ? ate : hoje;
    inicio = de && de <= fim ? de : new Date(fim.getTime() - 364 * DIA);
    // Limite de 3 anos para manter a consulta leve.
    if (fim.getTime() - inicio.getTime() > 3 * 366 * DIA) inicio = new Date(fim.getTime() - 3 * 366 * DIA);
  } else if (chave === "ano") {
    inicio = new Date(Date.UTC(hoje.getUTCFullYear(), 0, 1));
  } else {
    const dias = { "30d": 30, "90d": 90, "6m": 182, "12m": 365 }[chave];
    inicio = new Date(fim.getTime() - (dias - 1) * DIA);
  }
  const dias = Math.round((fim.getTime() - inicio.getTime()) / DIA) + 1;
  const fimAnterior = new Date(inicio.getTime() - DIA);
  const rotulo = chave === "personalizado" ? `${fmt(inicio)} a ${fmt(fim)}` : PERIODOS[chave];
  return { chave, inicio, fim, dias, rotulo, anterior: { inicio: new Date(fimAnterior.getTime() - (dias - 1) * DIA), fim: fimAnterior } };
}

const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
export const paramsPeriodo = (p: Periodo) => (p.chave === "personalizado" ? { periodo: p.chave, de: textoData(p.inicio), ate: textoData(p.fim) } : { periodo: p.chave });

export const ativoEm = (p: Pessoa, d: Date) => p.admissao <= d && (!p.saida || p.saida > d);
export const headcountEm = (pessoas: Pessoa[], d: Date) => pessoas.reduce((n, p) => n + (ativoEm(p, d) ? 1 : 0), 0);
const noIntervalo = (d: Date, inicio: Date, fim: Date) => d >= inicio && d <= fim;
export const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
export const umaCasaNum = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
export const mesesEntre = (a: Date, b: Date) => (b.getTime() - a.getTime()) / (30.4375 * DIA);

export type Turnover = {
  hcInicio: number;
  hcFim: number;
  hcMedio: number;
  admissoes: number;
  saidas: number;
  voluntarias: number;
  involuntarias: number;
  semClassificacao: number;
  lamentadas: number;
  precoces: number;
  primeiroAno: number;
  turnover: number | null;
  turnoverAnualizado: number | null;
  turnoverVoluntarioAnualizado: number | null;
  rotatividadeGeral: number | null;
  tempoMedioCasaSaidaMeses: number | null;
};

/** Indicadores de movimentação de um intervalo. */
export function calcularTurnover(pessoas: Pessoa[], saidas: Saida[], inicio: Date, fim: Date): Turnover {
  const dias = Math.round((fim.getTime() - inicio.getTime()) / DIA) + 1;
  const hcInicio = headcountEm(pessoas, new Date(inicio.getTime() - DIA));
  const hcFim = headcountEm(pessoas, fim);
  const hcMedio = (hcInicio + hcFim) / 2;
  const admissoes = pessoas.filter((p) => noIntervalo(p.admissao, inicio, fim)).length;
  const s = saidas.filter((x) => noIntervalo(x.data, inicio, fim));
  const voluntarias = s.filter((x) => x.voluntario === true).length;
  const casa = s.filter((x) => x.admissao).map((x) => (x.data.getTime() - x.admissao!.getTime()) / DIA);
  const turnover = pct(s.length, hcMedio);
  return {
    hcInicio,
    hcFim,
    hcMedio,
    admissoes,
    saidas: s.length,
    voluntarias,
    involuntarias: s.filter((x) => x.voluntario === false).length,
    semClassificacao: s.filter((x) => x.voluntario === null).length,
    lamentadas: s.filter((x) => x.perdaLamentada).length,
    precoces: casa.filter((d) => d < 90).length,
    primeiroAno: casa.filter((d) => d < 365).length,
    turnover: umaCasaNum(turnover),
    turnoverAnualizado: umaCasaNum(turnover === null ? null : (turnover * 365) / dias),
    turnoverVoluntarioAnualizado: umaCasaNum(hcMedio > 0 ? ((voluntarias / hcMedio) * 100 * 365) / dias : null),
    rotatividadeGeral: umaCasaNum(pct((admissoes + s.length) / 2, hcMedio)),
    tempoMedioCasaSaidaMeses: casa.length ? umaCasaNum(casa.reduce((a, b) => a + b, 0) / casa.length / 30.4375) : null,
  };
}

/** Das pessoas ativas em `fim − 365 dias`, quantas % seguem ativas em `fim`. */
export function retencao12m(pessoas: Pessoa[], fim: Date) {
  const base = new Date(fim.getTime() - 365 * DIA);
  const coorte = pessoas.filter((p) => ativoEm(p, base));
  return coorte.length ? umaCasaNum((coorte.filter((p) => ativoEm(p, fim)).length / coorte.length) * 100) : null;
}

export function tempoMedioCasaMeses(pessoas: Pessoa[], d: Date) {
  const ativos = pessoas.filter((p) => ativoEm(p, d));
  return ativos.length ? umaCasaNum(ativos.reduce((s, p) => s + mesesEntre(p.admissao, d), 0) / ativos.length) : null;
}

export type PontoMensal = { mes: string; rotulo: string; headcount: number; admissoes: number; saidas: number; voluntarias: number; turnover: number | null };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Série mensal (até 24 meses) terminando no mês de `fim`. */
export function serieMensal(pessoas: Pessoa[], saidas: Saida[], inicio: Date, fim: Date): PontoMensal[] {
  const pontos: PontoMensal[] = [];
  let a = fim.getUTCFullYear();
  let m = fim.getUTCMonth();
  const primeiro = Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1);
  while (pontos.length < 24) {
    const ini = new Date(Date.UTC(a, m, 1));
    if (ini.getTime() < primeiro && pontos.length >= 3) break;
    const ultimo = new Date(Date.UTC(a, m + 1, 0));
    const f = ultimo > fim ? fim : ultimo;
    const t = calcularTurnover(pessoas, saidas, ini, f);
    pontos.unshift({ mes: textoData(ini).slice(0, 7), rotulo: `${MESES[m]}/${String(a).slice(2)}`, headcount: t.hcFim, admissoes: t.admissoes, saidas: t.saidas, voluntarias: t.voluntarias, turnover: t.turnover });
    m -= 1;
    if (m < 0) {
      m = 11;
      a -= 1;
    }
  }
  return pontos;
}

/** Inclinação (mínimos quadrados) de uma série — usada para indicar tendência. */
export function inclinacao(valores: number[]) {
  const n = valores.length;
  if (n < 3) return 0;
  const mx = (n - 1) / 2;
  const my = valores.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  valores.forEach((v, i) => {
    num += (i - mx) * (v - my);
    den += (i - mx) ** 2;
  });
  return den ? num / den : 0;
}

/**
 * Projeção de saídas para os próximos 90 dias: média mensal ponderada dos últimos
 * 6 meses (meses recentes pesam mais) × 3, ajustada pela proporção de pessoas em
 * risco alto em relação ao histórico. Intervalo ≈ ±1,64·√μ (aproximação de Poisson, 90%).
 * É uma tendência para planejamento — não prevê quem vai sair.
 */
export function projetarSaidas90d(serie: PontoMensal[], emRiscoAlto: number, headcount: number) {
  const ult = serie.slice(-6);
  if (!ult.length || headcount === 0) return null;
  const pesos = ult.map((_, i) => i + 1);
  const mediaMensal = ult.reduce((s, p, i) => s + p.saidas * pesos[i], 0) / pesos.reduce((a, b) => a + b, 0);
  // Fator de risco: +30% se mais de 15% das pessoas estão em risco alto, +15% acima de 8%.
  const parcela = emRiscoAlto / headcount;
  const fator = parcela > 0.15 ? 1.3 : parcela > 0.08 ? 1.15 : 1;
  const esperado = mediaMensal * 3 * fator;
  const margem = 1.64 * Math.sqrt(Math.max(esperado, 0.0001));
  return {
    esperado: umaCasaNum(esperado)!,
    minimo: Math.max(0, Math.floor(esperado - margem)),
    maximo: Math.ceil(esperado + margem),
    turnoverAnualizado: umaCasaNum(((esperado * 4) / headcount) * 100),
    fator,
  };
}

/** Distribuição por faixa de tempo de casa na saída. */
export const FAIXAS_CASA = [
  { chave: "0-3m", nome: "Até 3 meses", ate: 91 },
  { chave: "3-6m", nome: "3 a 6 meses", ate: 183 },
  { chave: "6-12m", nome: "6 a 12 meses", ate: 366 },
  { chave: "1-2a", nome: "1 a 2 anos", ate: 731 },
  { chave: "2-5a", nome: "2 a 5 anos", ate: 1827 },
  { chave: "5a+", nome: "Mais de 5 anos", ate: Infinity },
] as const;

export function faixaCasa(admissao: Date | null, saida: Date) {
  if (!admissao) return null;
  const d = (saida.getTime() - admissao.getTime()) / DIA;
  return FAIXAS_CASA.find((f) => d < f.ate)!.chave;
}

/** Conta ocorrências e ordena (maior primeiro). */
export function contar<T extends string>(itens: (T | null | undefined)[]) {
  const m = new Map<T, number>();
  for (const i of itens) if (i) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([chave, n]) => ({ chave, n }));
}

/** Variação entre dois valores para o selo de comparação (pontos ou %). */
export function variacao(atual: number | null, anterior: number | null) {
  if (atual === null || anterior === null) return null;
  return umaCasaNum(atual - anterior);
}
