/** Aba "Turnover": taxa do período e custo estimado de um desligamento. */
import { $, copyText, el, formatBRL } from "../ui.js";
import {
  DEFAULT_CLT_COST_FACTOR,
  LOST_PRODUCTIVITY,
  cltTermination,
  pjTermination,
  replacementCosts,
  sum,
  turnoverRate,
} from "./calc.js";

const FIELDS = [
  "tov-hc-ini",
  "tov-hc-fim",
  "tov-adm",
  "tov-desl",
  "tov-salario",
  "tov-admissao",
  "tov-deslig",
  "tov-valor-pj",
  "tov-aviso-pj",
  "tov-multa-pj",
  "tov-recrut",
  "tov-trein",
  "tov-vaga",
  "tov-rampa",
];

const num = (id) => {
  const value = parseFloat($(id).value);
  return Number.isFinite(value) && value >= 0 ? value : 0;
};
const date = (id) => ($(id).value ? new Date(`${$(id).value}T12:00:00`) : null);
const regime = () => document.querySelector('input[name="tov-regime"]:checked').value;
const percent = (value) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

let summary = "";

function metric(label, value) {
  const box = el("div", "metric");
  box.append(el("p", "metric__label", label), el("p", "metric__value", value));
  return box;
}

function breakdownTable(groups, total) {
  const table = el("table", "breakdown");
  const tbody = el("tbody");
  for (const [title, items] of groups) {
    if (!items.length) continue;
    const head = el("tr", "group-row");
    const th = el("th", null, title);
    th.colSpan = 2;
    head.append(th);
    tbody.append(head);
    for (const item of items) {
      const row = el("tr");
      const label = el("th", null, item.rotulo);
      label.scope = "row";
      row.append(label, el("td", null, formatBRL(item.valor, { cents: true })));
      tbody.append(row);
    }
  }
  const totalRow = el("tr", "total-row");
  const label = el("th", null, "Custo total estimado");
  label.scope = "row";
  totalRow.append(label, el("td", null, formatBRL(total, { cents: true })));
  tbody.append(totalRow);
  table.append(tbody);
  return table;
}

function calculate() {
  const lines = [];

  // Taxa do período
  const rate = turnoverRate({
    headcountInicio: num("tov-hc-ini"),
    headcountFim: num("tov-hc-fim"),
    admissoes: num("tov-adm"),
    desligamentos: num("tov-desl"),
  });
  if (rate) {
    $("tov-rate-out").replaceChildren(
      metric("Turnover", percent(rate.taxaTurnover)),
      metric("Desligamentos", percent(rate.taxaDesligamento)),
      metric("Headcount médio", rate.headcountMedio.toLocaleString("pt-BR")),
    );
    lines.push(
      `Turnover do período: ${percent(rate.taxaTurnover)} (desligamentos: ${percent(rate.taxaDesligamento)}; headcount médio: ${rate.headcountMedio.toLocaleString("pt-BR")})`,
    );
  } else {
    $("tov-rate-out").replaceChildren(el("p", "hint", "Preencha o headcount para calcular a taxa."));
  }

  // Custo de um desligamento
  const isClt = regime() === "clt";
  $("tov-clt").hidden = !isClt;
  $("tov-pj").hidden = isClt;

  let rescisao = [];
  let custoMensal = 0;
  let ready = false;
  if (isClt) {
    const salario = num("tov-salario");
    const admissao = date("tov-admissao");
    const desligamento = date("tov-deslig");
    custoMensal = salario * DEFAULT_CLT_COST_FACTOR;
    $("tov-assumption").textContent =
      `Vaga em aberto e rampa usam o custo total estimado do CLT (salário × ${DEFAULT_CLT_COST_FACTOR} = ${formatBRL(custoMensal)}/mês) e ${LOST_PRODUCTIVITY * 100}% de produtividade perdida.`;
    if (salario > 0 && admissao && desligamento && desligamento > admissao) {
      rescisao = cltTermination({ salario, admissao, desligamento }).itens;
      ready = true;
    }
  } else {
    custoMensal = num("tov-valor-pj");
    $("tov-assumption").textContent =
      `Vaga em aberto e rampa usam o valor mensal do contrato e ${LOST_PRODUCTIVITY * 100}% de produtividade perdida.`;
    if (custoMensal > 0) {
      rescisao = pjTermination({
        valorMensal: custoMensal,
        diasAviso: num("tov-aviso-pj"),
        avisoIndenizado: $("tov-aviso-indenizado").checked,
        multaContratual: num("tov-multa-pj"),
      }).itens;
      ready = true;
    }
  }

  if (!ready) {
    $("tov-cost-out").replaceChildren(
      el("p", "hint", isClt ? "Informe salário, admissão e desligamento." : "Informe o valor mensal do contrato."),
    );
    summary = lines.join("\n");
    return;
  }

  const reposicao = replacementCosts({
    custoMensal,
    recrutamento: num("tov-recrut"),
    treinamento: num("tov-trein"),
    diasVagaAberta: num("tov-vaga"),
    mesesRampa: num("tov-rampa"),
  });
  const total = sum(rescisao) + sum(reposicao);
  const nodes = [
    breakdownTable(
      [
        [isClt ? "Rescisão (CLT)" : "Rescisão (PJ)", rescisao],
        ["Reposição", reposicao],
      ],
      total,
    ),
  ];

  const desligamentos = num("tov-desl");
  if (desligamentos > 0) {
    const projection = el("div", "metrics");
    projection.append(metric(`Custo de ${desligamentos} desligamento(s) no período`, formatBRL(total * desligamentos)));
    nodes.push(projection);
  }
  $("tov-cost-out").replaceChildren(...nodes);

  lines.push(
    "",
    `Custo estimado de um desligamento (${isClt ? "CLT" : "PJ"}): ${formatBRL(total, { cents: true })}`,
    ...[...rescisao, ...reposicao].map((i) => `- ${i.rotulo}: ${formatBRL(i.valor, { cents: true })}`),
  );
  if (desligamentos > 0) lines.push(`Projeção para ${desligamentos} desligamento(s): ${formatBRL(total * desligamentos)}`);
  lines.push("", "Estimativa simplificada; não substitui o cálculo trabalhista ou contábil.");
  summary = lines.join("\n");
}

export function initTurnoverArea() {
  for (const id of FIELDS) $(id).addEventListener("input", calculate);
  $("tov-aviso-indenizado").addEventListener("change", calculate);
  for (const radio of document.querySelectorAll('input[name="tov-regime"]')) radio.addEventListener("change", calculate);
  $("tov-deslig").value = new Date().toISOString().slice(0, 10);
  $("tov-copy").addEventListener("click", () => copyText(summary, "tov-copy-status", "Resumo copiado."));
  calculate();
}
