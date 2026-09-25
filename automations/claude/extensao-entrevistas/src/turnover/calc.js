/**
 * Cálculos simplificados de turnover. Estimativas para apoio à decisão, não
 * substituem o cálculo trabalhista ou contábil.
 *
 * CLT: dispensa sem justa causa, aviso prévio indenizado, sem férias vencidas.
 * PJ: rescisão conforme contrato (aviso e multa informados pelo usuário).
 */

// Custo total aproximado de um CLT sobre o salário (encargos e benefícios),
// usado só para estimar perda de produtividade quando o usuário não informa.
export const DEFAULT_CLT_COST_FACTOR = 1.7;
// Produtividade perdida enquanto a vaga está aberta e durante a rampa do
// substituto.
export const LOST_PRODUCTIVITY = 0.5;

/** Taxa de turnover do período (fórmula usual: média entre admissões e desligamentos). */
export function turnoverRate({ headcountInicio, headcountFim, admissoes, desligamentos }) {
  const headcountMedio = (headcountInicio + headcountFim) / 2;
  if (!(headcountMedio > 0)) return null;
  return {
    headcountMedio,
    taxaTurnover: (((admissoes + desligamentos) / 2) / headcountMedio) * 100,
    taxaDesligamento: (desligamentos / headcountMedio) * 100,
  };
}

/** Meses completos entre duas datas; a fração de 15 dias ou mais conta como mês. */
function monthsBetween(start, end) {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  const days = end.getDate() - start.getDate();
  if (days < 0) months -= 1;
  const anchor = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
  const remainingDays = Math.round((end - anchor) / 86_400_000);
  return Math.max(0, months + (remainingDays >= 15 ? 1 : 0));
}

/** Meses para o 13º no ano do desligamento (mês com 15+ dias trabalhados conta). */
function thirteenthMonths(admissao, desligamento) {
  const startOfYear = new Date(desligamento.getFullYear(), 0, 1);
  const start = admissao > startOfYear ? admissao : startOfYear;
  return Math.min(12, monthsBetween(start, new Date(desligamento.getTime() + 86_400_000)));
}

/** Verbas de desligamento CLT (dispensa sem justa causa). */
export function cltTermination({ salario, admissao, desligamento }) {
  const mesesDeCasa = monthsBetween(admissao, desligamento);
  const anosCompletos = Math.floor(mesesDeCasa / 12);
  const diasAviso = Math.min(30 + 3 * anosCompletos, 90);
  const avisoPrevio = (salario / 30) * diasAviso;
  const mesesFerias = mesesDeCasa % 12;
  const feriasProporcionais = salario * (mesesFerias / 12) * (4 / 3);
  const meses13 = thirteenthMonths(admissao, desligamento);
  const decimoTerceiro = salario * (meses13 / 12);
  const saldoFgtsEstimado = 0.08 * salario * mesesDeCasa;
  const multaFgts = 0.4 * saldoFgtsEstimado;
  const fgtsRescisao = 0.08 * (avisoPrevio + decimoTerceiro);

  return {
    detalhes: { mesesDeCasa, anosCompletos, diasAviso, mesesFerias, meses13 },
    itens: [
      { rotulo: `Aviso prévio indenizado (${diasAviso} dias)`, valor: avisoPrevio },
      { rotulo: `Férias proporcionais + 1/3 (${mesesFerias}/12)`, valor: feriasProporcionais },
      { rotulo: `13º proporcional (${meses13}/12)`, valor: decimoTerceiro },
      { rotulo: "Multa de 40% do FGTS (saldo estimado)", valor: multaFgts },
      { rotulo: "FGTS sobre aviso e 13º", valor: fgtsRescisao },
    ],
  };
}

/** Rescisão de contrato PJ, conforme cláusulas informadas. */
export function pjTermination({ valorMensal, diasAviso, avisoIndenizado, multaContratual }) {
  const itens = [];
  if (avisoIndenizado && diasAviso > 0) {
    itens.push({ rotulo: `Aviso contratual indenizado (${diasAviso} dias)`, valor: (valorMensal / 30) * diasAviso });
  }
  if (multaContratual > 0) itens.push({ rotulo: "Multa contratual", valor: multaContratual });
  return { itens };
}

/** Custos de reposição, comuns a CLT e PJ. */
export function replacementCosts({ custoMensal, recrutamento, treinamento, diasVagaAberta, mesesRampa }) {
  return [
    { rotulo: "Recrutamento e seleção", valor: recrutamento },
    { rotulo: "Integração e treinamento", valor: treinamento },
    {
      rotulo: `Vaga em aberto (${diasVagaAberta} dias, ${LOST_PRODUCTIVITY * 100}% de impacto)`,
      valor: (custoMensal / 30) * diasVagaAberta * LOST_PRODUCTIVITY,
    },
    {
      rotulo: `Rampa até produtividade plena (${mesesRampa} meses, ${LOST_PRODUCTIVITY * 100}% de impacto)`,
      valor: custoMensal * mesesRampa * LOST_PRODUCTIVITY,
    },
  ].filter((item) => item.valor > 0);
}

export const sum = (items) => items.reduce((total, item) => total + item.valor, 0);
