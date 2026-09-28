/** Aba "Turnover": taxa do período e custo estimado de um desligamento. */
import { $, copyText, el, formatBRL } from "../ui.js";
import {
  DEFAULT_CLT_COST_FACTOR,
  LOST_PRODUCTIVITY,
  cltTermination,
  pjTermination,
  replacementCosts,
  sum,
} from "./calc.js";

const FIELDS = [
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

let summary = "";

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

  $("tov-cost-out").replaceChildren(...nodes);

  lines.push(
    `Custo estimado de um desligamento (${isClt ? "CLT" : "PJ"}): ${formatBRL(total, { cents: true })}`,
    ...[...rescisao, ...reposicao].map((i) => `- ${i.rotulo}: ${formatBRL(i.valor, { cents: true })}`),
  );
  lines.push("", "Estimativa simplificada; não substitui o cálculo trabalhista ou contábil.");
  summary = lines.join("\n");
}

// Valores iniciais dos campos de custo ao limpar.
const COST_DEFAULTS = {
  "tov-salario": "",
  "tov-admissao": "",
  "tov-valor-pj": "",
  "tov-aviso-pj": "30",
  "tov-multa-pj": "0",
  "tov-recrut": "0",
  "tov-trein": "0",
  "tov-vaga": "30",
  "tov-rampa": "3",
};

function clearCost() {
  for (const [id, value] of Object.entries(COST_DEFAULTS)) $(id).value = value;
  $("tov-deslig").value = new Date().toISOString().slice(0, 10);
  $("tov-aviso-indenizado").checked = true;
  $("tov-copy-status").textContent = "";
  calculate();
  (regime() === "clt" ? $("tov-salario") : $("tov-valor-pj")).focus();
}

export function initTurnoverArea() {
  $("tov-cost-clear").addEventListener("click", clearCost);
  for (const id of FIELDS) $(id).addEventListener("input", calculate);
  $("tov-aviso-indenizado").addEventListener("change", calculate);
  for (const radio of document.querySelectorAll('input[name="tov-regime"]')) radio.addEventListener("change", calculate);
  $("tov-deslig").value = new Date().toISOString().slice(0, 10);
  $("tov-copy").addEventListener("click", () => copyText(summary, "tov-copy-status", "Resumo copiado."));
  calculate();
}
