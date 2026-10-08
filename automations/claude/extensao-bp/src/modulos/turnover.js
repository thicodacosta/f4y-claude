/**
 * Turnover: taxas (fórmulas do People Analytics do JourneyLab), custo
 * estimado das saídas (cálculo da calculadora da ToolsKit), motivos, risco de
 * saída indicativo por pessoa e projeção de saídas.
 */
import { cabecalhoModulo } from "../core/acoes.js";
import { colaborador, nomeDe, respostas, store } from "../core/db.js";
import * as I from "../core/indicadores.js";
import { barras, colunas } from "../core/graficos.js";
import * as calc from "../core/toolskit.js";
import { campo, h, kpi, modal, selo, vazio, encher } from "../core/ui.js";
import { seletorColaborador } from "./pessoas.js";

const brl = (v) => calc.formatBRL(v);

/** Custo de cada saída: o gravado no registro ou, sem ele, o estimado agora. */
export function custoDe(d) {
  if (d.custo != null) return Number(d.custo);
  const c = colaborador(d.colaborador_id);
  return c ? I.custoDesligamento(c, d, calc)?.total ?? null : null;
}

/** Favorabilidade por área no Pulso mais recente com respostas (para o risco). */
export async function favorabilidadeRecente() {
  const pesquisa = store.pesquisas.find((p) => p.tipo !== "offboarding" && p.total_respostas >= I.MINIMO_RECORTE);
  if (!pesquisa) return new Map();
  const lista = (await respostas().catch(() => [])).filter((r) => r.pesquisa_id === pesquisa.id);
  return I.favorabilidadePorArea(pesquisa, lista);
}

export function indicadoresTurnover(fav = new Map()) {
  const hoje = I.hojeISO();
  const ini = I.somarDias(hoje, -364);
  const { colaboradores, desligamentos } = store;
  const geral = I.turnoverPeriodo(colaboradores, desligamentos, ini, hoje);
  const vol = I.turnoverPeriodo(colaboradores, desligamentos, ini, hoje, (d) => d.voluntario);
  const saidas = desligamentos.filter((d) => d.data >= ini);
  const custos = saidas.map(custoDe).filter((v) => v != null);
  const precoces = saidas.filter((d) => {
    const c = colaborador(d.colaborador_id);
    return c?.admissao && I.diasEntre(c.admissao, d.data) < 90;
  });
  const riscos = I.riscos(store, fav);
  const taxaMensal = geral.hcMedio ? geral.saidas / geral.hcMedio / 12 : 0;
  const esperadas = I.saidasEsperadas(riscos, taxaMensal, 3);
  const serie = I.serieMensal(store, 12);
  const proj = Array.from({ length: 3 }, (_, k) => I.saidasEsperadas(riscos, taxaMensal, k + 1) - (k ? I.saidasEsperadas(riscos, taxaMensal, k) : 0));
  const porArea = new Map();
  for (const d of saidas) {
    const a = colaborador(d.colaborador_id)?.area || "Sem área";
    porArea.set(a, (porArea.get(a) ?? 0) + 1);
  }
  const porMotivo = new Map();
  for (const d of saidas) if (d.motivo) porMotivo.set(d.motivo, (porMotivo.get(d.motivo) ?? 0) + 1);
  return { geral, vol, saidas, custos, precoces, riscos, esperadas, serie, proj, porArea, porMotivo, taxaMensal };
}

export function relatorioTurnover(fav) {
  const x = indicadoresTurnover(fav);
  const custoTotal = x.custos.reduce((s, v) => s + v, 0);
  const altos = x.riscos.filter((r) => r.nivel === "alto");
  return {
    modulo: "turnover",
    titulo: "Turnover",
    subtitulo: "Últimos 12 meses e projeção dos próximos 3",
    kpis: [
      { rotulo: "Turnover 12 meses", valor: I.pct(x.geral.taxa, 1), detalhe: `${x.geral.saidas} saídas · headcount médio ${I.umaCasa(x.geral.hcMedio)}` },
      { rotulo: "Turnover voluntário", valor: I.pct(x.vol.taxa, 1), detalhe: `${x.vol.saidas} pedidos/acordos` },
      { rotulo: "Custo estimado das saídas", valor: brl(custoTotal), detalhe: x.custos.length < x.saidas.length ? `${x.saidas.length - x.custos.length} sem salário cadastrado` : null },
      { rotulo: "Saída precoce (< 90 dias)", valor: x.saidas.length ? I.pct((x.precoces.length / x.saidas.length) * 100) : "—" },
      { rotulo: "Saídas esperadas em 90 dias", valor: I.umaCasa(x.esperadas), detalhe: "Projeção indicativa pelo risco" },
      { rotulo: "Pessoas em risco alto", valor: String(altos.length) },
    ],
    destaques: [
      x.porMotivo.size ? `Principal motivo de saída: ${I.MOTIVOS[[...x.porMotivo].sort((a, b) => b[1] - a[1])[0][0]]}.` : null,
      x.porArea.size ? `Área com mais saídas: ${[...x.porArea].sort((a, b) => b[1] - a[1])[0][0]}.` : null,
      altos.length ? `Risco alto (indicativo): ${altos.slice(0, 5).map((r) => r.colaborador.nome).join(", ")}.` : "Nenhuma pessoa em risco alto agora.",
      x.saidas.length && custoTotal ? `Custo médio por saída: ${brl(custoTotal / x.custos.length)}.` : null,
    ].filter(Boolean),
    graficos: [
      { titulo: "Saídas por mês (e projeção)", tipo: "colunas", casas: 1, itens: [...x.serie.map((m) => ({ rotulo: I.rotuloMes(m.mes), valor: m.saidas })), ...x.proj.map((v, i) => ({ rotulo: I.rotuloMes(I.proximosMeses(3)[i]), valor: v, projetado: true }))] },
      { titulo: "Saídas por área (12 meses)", tipo: "barras", casas: 0, itens: [...x.porArea].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor) },
      { titulo: "Motivos de saída (12 meses)", tipo: "barras", casas: 0, itens: [...x.porMotivo].map(([m, valor]) => ({ rotulo: I.MOTIVOS[m] ?? m, valor })).sort((a, b) => b.valor - a.valor) },
    ],
    tabelas: [
      { titulo: "Risco de saída (indicativo)", colunas: ["Pessoa", "Área", "Pontos", "Fatores"], linhas: x.riscos.filter((r) => r.pontos > 0).slice(0, 25).map((r) => [r.colaborador.nome, r.colaborador.area ?? "—", String(r.pontos), r.fatores.map((f) => f.texto).join("; ")]) },
      { titulo: "Saídas dos últimos 12 meses", colunas: ["Pessoa", "Data", "Tipo", "Motivo", "Custo"], linhas: x.saidas.map((d) => [nomeDe(d.colaborador_id), I.fmtData(d.data), I.TIPO_DESLIGAMENTO[d.tipo]?.nome ?? d.tipo, I.MOTIVOS[d.motivo] ?? "—", custoDe(d) != null ? brl(custoDe(d)) : "—"]) },
    ],
    textos: [{ titulo: "Metodologia", texto: "Turnover = saídas ÷ headcount médio (início e fim do período) × 100. Custo = verbas rescisórias estimadas (CLT, dispensa sem justa causa ou acordo) + reposição (recrutamento, treinamento, 45 dias de vaga aberta e 3 meses de rampa a 50%). Risco e projeção são indicativos, para priorizar conversas e ações; nunca para decidir sobre pessoas." }],
  };
}

function simular() {
  return modal("Simular o custo de uma saída", () => {
    const { sel, bloco } = seletorColaborador();
    const tipo = h("select", {}, Object.entries(I.TIPO_DESLIGAMENTO).map(([v, t]) => h("option", { value: v }, t.nome)));
    const saida = h("div", { role: "status" });
    const calcular = () => {
      const c = colaborador(sel.value);
      if (!c) return saida.replaceChildren();
      if (!c.salario) return saida.replaceChildren(h("p", { class: "hint", text: "Cadastre a remuneração deste colaborador para estimar o custo." }));
      const r = I.custoDesligamento(c, { tipo: tipo.value, data: I.hojeISO() }, calc);
      encher(saida, 
        h("table", { class: "tabela" }, h("tbody", {}, r.itens.map((i) => h("tr", {}, h("td", { text: i.rotulo }), h("td", { class: "num", text: brl(i.valor) }))), h("tr", { class: "total" }, h("td", { text: "Total estimado" }), h("td", { class: "num", text: brl(r.total) })))),
        h("p", { class: "hint", text: "Estimativa para gestão, não substitui o cálculo trabalhista." }),
      );
    };
    sel.addEventListener("change", calcular);
    tipo.addEventListener("change", calcular);
    return h("div", {}, bloco, campo("Tipo de desligamento", tipo), saida);
  });
}

export function criarTurnover(app) {
  const raiz = h("section", { class: "modulo" });
  let fav = new Map();

  async function render() {
    fav = await favorabilidadeRecente();
    const rel = relatorioTurnover(fav);
    const x = indicadoresTurnover(fav);
    const riscos = x.riscos.filter((r) => r.pontos > 0);
    encher(raiz, 
      cabecalhoModulo({ eyebrow: "Turnover", titulo: "Turnover e retenção", lead: "Taxas, custo das saídas, motivos e quem merece uma conversa agora.", montar: () => relatorioTurnover(fav) }),
      h("div", { class: "kpis" }, rel.kpis.map((k) => kpi(k.rotulo, k.valor, k.detalhe))),
      h("button", { type: "button", class: "btn btn--ghost", onclick: simular }, "Simular o custo de uma saída"),
      h("div", { class: "card" }, h("h2", { text: "Saídas por mês" }), h("p", { class: "hint", text: "Últimos 12 meses; as 3 colunas claras são a projeção indicativa pelo risco atual." }), colunas(x.serie.map((m) => m.saidas), x.serie.map((m) => I.rotuloMes(m.mes)), { projecao: x.proj, rotulosProjecao: I.proximosMeses(3).map(I.rotuloMes), casas: 0, nome: "Saídas", rotulo: "Saídas por mês com projeção" })),
      x.porMotivo.size ? h("div", { class: "card" }, h("h2", { text: "Motivos de saída" }), barras(rel.graficos[2].itens, { casas: 0, rotulo: "Motivos de saída" })) : null,
      x.porArea.size ? h("div", { class: "card" }, h("h2", { text: "Saídas por área" }), barras(rel.graficos[1].itens, { casas: 0, rotulo: "Saídas por área" })) : null,
      h(
        "div",
        { class: "card" },
        h("h2", { text: "Risco de saída (indicativo)" }),
        h("p", { class: "hint", text: "Pontuação transparente a partir de tempo de casa, avaliações, onboarding, saídas do gestor/área e clima. Use para priorizar conversas, nunca para decidir sobre a pessoa." }),
        riscos.length
          ? h(
              "ul",
              { class: "lista lista--compacta" },
              riscos.slice(0, 20).map((r) =>
                h(
                  "li",
                  {},
                  h(
                    "button",
                    { type: "button", class: "linha-item", onclick: () => app.abrirPessoa(r.colaborador.id) },
                    h("span", { class: "linha-item__principal" }, h("strong", { text: r.colaborador.nome }), h("span", { class: "hint", text: r.fatores.map((f) => f.texto).join(" · ") })),
                    selo(`${r.pontos} pts`, I.NIVEL[r.nivel].tom),
                  ),
                ),
              ),
            )
          : vazio("Nenhum sinal de risco nos dados atuais."),
      ),
      x.saidas.length
        ? h(
            "details",
            { class: "card" },
            h("summary", { text: `Saídas dos últimos 12 meses (${x.saidas.length})` }),
            h("table", { class: "tabela" }, h("thead", {}, h("tr", {}, ["Pessoa", "Data", "Custo"].map((t) => h("th", { text: t })))), h("tbody", {}, x.saidas.map((d) => h("tr", {}, h("td", { text: nomeDe(d.colaborador_id) }), h("td", { text: I.fmtData(d.data) }), h("td", { class: "num", text: custoDe(d) != null ? brl(custoDe(d)) : "—" }))))),
          )
        : null,
    );
  }

  return { raiz, render };
}
