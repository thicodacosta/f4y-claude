/**
 * Offboarding (base: Offboarding do JourneyLab): registro do desligamento
 * com fotografia do vínculo e custo estimado, checklist de saída e
 * entrevista de desligamento por link de uso único (mesma página pública do
 * Pulso; a resposta volta para o registro pelo gatilho do banco).
 */
import { cabecalhoModulo, barraAcoes } from "../core/acoes.js";
import { urlPublica } from "../core/config.js";
import { atualizar, carregar, colaborador, excluir, inserir, nomeDe, store } from "../core/db.js";
import * as I from "../core/indicadores.js";
import { barras } from "../core/graficos.js";
import { ENTREVISTA_DESLIGAMENTO, linkPublico } from "../core/pesquisas.js";
import * as calc from "../core/toolskit.js";
import { campo, confirmar, h, icone, kpi, modal, select, selo, toast, vazio } from "../core/ui.js";
import { seletorColaborador } from "./pessoas.js";

const brl = (v) => calc.formatBRL(v);
const pesquisaDe = (d) => store.pesquisas.find((p) => p.id === d.pesquisa_id);

function statusEntrevista(d) {
  if (d.entrevista) return { nome: "Entrevista respondida", tom: "sucesso" };
  if (d.pesquisa_id) return { nome: "Aguardando resposta", tom: "info" };
  return { nome: "Entrevista pendente", tom: "alerta" };
}

/** Rótulo da opção escolhida numa pergunta da entrevista. */
function resposta(q, valor) {
  if (valor == null || valor === "") return "—";
  if (q.tipo === "multipla") return valor.map((v) => q.opcoes.find((o) => o.id === v)?.rotulo ?? v).join(", ");
  if (q.tipo === "escolha") return q.opcoes.find((o) => o.id === valor)?.rotulo ?? valor;
  return String(valor);
}

export function relatorioOffboarding() {
  const ini = I.somarDias(I.hojeISO(), -364);
  const lista = store.desligamentos.filter((d) => d.data >= ini);
  const respondidas = lista.filter((d) => d.entrevista);
  const qMotivos = ENTREVISTA_DESLIGAMENTO[0];
  const qNps = ENTREVISTA_DESLIGAMENTO.find((x) => x.tipo === "nps");
  const qEvit = ENTREVISTA_DESLIGAMENTO.find((x) => x.dimensao === "Evitável" && x.tipo === "escolha");
  const motivos = new Map();
  for (const d of respondidas) for (const m of d.entrevista[qMotivos.id] ?? []) motivos.set(m, (motivos.get(m) ?? 0) + 1);
  const notas = respondidas.map((d) => d.entrevista[qNps.id]).filter((n) => n != null).map(Number);
  const evitaveis = respondidas.filter((d) => ["o1", "o2"].includes(d.entrevista[qEvit.id])).length;
  const experiencia = ENTREVISTA_DESLIGAMENTO.filter((x) => x.dimensao === "Experiência").map((x) => {
    const vals = respondidas.map((d) => I.valorNumerico(x, d.entrevista[x.id])).filter((v) => v != null);
    return { rotulo: x.texto, valor: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null };
  });
  return {
    modulo: "offboarding",
    titulo: "Offboarding",
    subtitulo: "Desligamentos e entrevistas dos últimos 12 meses",
    kpis: [
      { rotulo: "Desligamentos", valor: String(lista.length), detalhe: `${lista.filter((d) => d.voluntario).length} voluntários` },
      { rotulo: "Entrevistas respondidas", valor: lista.length ? I.pct((respondidas.length / lista.length) * 100) : "—", detalhe: `${respondidas.length} de ${lista.length}` },
      { rotulo: "eNPS de saída", valor: notas.length ? String(I.enps(notas)) : "—" },
      { rotulo: "Saídas evitáveis (sim/talvez)", valor: respondidas.length ? I.pct((evitaveis / respondidas.length) * 100) : "—" },
      { rotulo: "Perdas lamentadas", valor: String(lista.filter((d) => d.lamentada).length) },
    ],
    destaques: [
      motivos.size ? `Fator mais citado nas entrevistas: ${qMotivos.opcoes.find((o) => o.id === [...motivos].sort((a, b) => b[1] - a[1])[0][0])?.rotulo}.` : null,
      experiencia.filter((e) => e.valor != null).length ? `Pior avaliação da experiência: ${[...experiencia].filter((e) => e.valor != null).sort((a, b) => a.valor - b.valor)[0].rotulo}.` : null,
      lista.filter((d) => !d.pesquisa_id).length ? `${lista.filter((d) => !d.pesquisa_id).length} desligamento(s) sem entrevista enviada.` : null,
    ].filter(Boolean),
    graficos: [
      { titulo: "Fatores citados nas entrevistas", tipo: "barras", casas: 0, itens: [...motivos].map(([id, n]) => ({ rotulo: qMotivos.opcoes.find((o) => o.id === id)?.rotulo ?? id, valor: n })).sort((a, b) => b.valor - a.valor) },
      { titulo: "Experiência na empresa (1 a 5)", tipo: "barras", max: 5, itens: experiencia },
    ],
    tabelas: [{ titulo: "Desligamentos", colunas: ["Pessoa", "Data", "Tipo", "Motivo declarado", "Entrevista"], linhas: lista.map((d) => [nomeDe(d.colaborador_id), I.fmtData(d.data), I.TIPO_DESLIGAMENTO[d.tipo]?.nome ?? d.tipo, I.MOTIVOS[d.motivo] ?? "—", statusEntrevista(d).nome]) }],
    textos: [{ titulo: "Sugestões deixadas", texto: respondidas.map((d) => d.entrevista[ENTREVISTA_DESLIGAMENTO.at(-1).id]).filter(Boolean).map((t) => `• ${t}`).join("\n") }],
  };
}

function relatorioUm(d) {
  const c = colaborador(d.colaborador_id);
  return {
    modulo: "offboarding",
    colaboradorId: d.colaborador_id,
    titulo: `Desligamento · ${c?.nome ?? ""}`,
    subtitulo: [c?.cargo, c?.area, I.fmtData(d.data)].filter(Boolean).join(" · "),
    kpis: [
      { rotulo: "Tipo", valor: I.TIPO_DESLIGAMENTO[d.tipo]?.nome ?? d.tipo },
      { rotulo: "Tempo de casa", valor: c ? I.tempoDeCasa(c) : "—" },
      { rotulo: "Custo estimado", valor: d.custo != null ? brl(Number(d.custo)) : "—" },
    ],
    destaques: [d.motivo ? `Motivo declarado: ${I.MOTIVOS[d.motivo]}` : null, d.lamentada ? "Perda lamentada (pessoa que a empresa gostaria de manter)." : null].filter(Boolean),
    tabelas: [
      { titulo: "Custo estimado", colunas: ["Item", "Valor"], linhas: (d.custo_detalhe ?? []).map((i) => [i.rotulo, brl(i.valor)]) },
      { titulo: "Entrevista de desligamento", colunas: ["Pergunta", "Resposta"], linhas: d.entrevista ? ENTREVISTA_DESLIGAMENTO.map((q) => [q.texto, resposta(q, d.entrevista[q.id])]) : [] },
    ],
    textos: [{ titulo: "Observações", texto: d.observacoes }],
  };
}

async function registrar(colaboradorId) {
  return modal(
    "Registrar desligamento",
    (fechar) => {
      const { sel, bloco } = seletorColaborador({ valor: colaboradorId ?? "" });
      const data = h("input", { type: "date", value: I.hojeISO() });
      const tipo = select(Object.entries(I.TIPO_DESLIGAMENTO).map(([v, t]) => [v, t.nome]), "pedido_demissao");
      const motivo = select([["", "Não informado"], ...Object.entries(I.MOTIVOS)], "");
      const lamentada = h("input", { type: "checkbox" });
      const obs = h("textarea", { rows: 3 });
      const custo = h("div", { class: "hint", role: "status" });
      const erro = h("p", { class: "error", hidden: true });
      const previa = () => {
        const c = colaborador(sel.value);
        const r = c && I.custoDesligamento(c, { tipo: tipo.value, data: data.value || I.hojeISO() }, calc);
        custo.textContent = c ? (r ? `Custo estimado: ${brl(r.total)} (verbas + reposição).` : "Sem remuneração cadastrada: o custo não será estimado.") : "";
      };
      [sel, tipo, data].forEach((x) => x.addEventListener("change", previa));
      previa();
      return h(
        "form",
        {
          onsubmit: async (e) => {
            e.preventDefault();
            const c = colaborador(sel.value);
            if (!c) return Object.assign(erro, { textContent: "Escolha o colaborador.", hidden: false });
            const r = I.custoDesligamento(c, { tipo: tipo.value, data: data.value }, calc);
            try {
              const d = await inserir(
                "bp_desligamentos",
                {
                  colaborador_id: c.id,
                  data: data.value || I.hojeISO(),
                  tipo: tipo.value,
                  voluntario: I.TIPO_DESLIGAMENTO[tipo.value].voluntario,
                  motivo: motivo.value || null,
                  lamentada: lamentada.checked,
                  observacoes: obs.value.trim() || null,
                  custo: r ? Math.round(r.total * 100) / 100 : null,
                  custo_detalhe: r?.itens ?? null,
                  checklist: I.CHECKLIST_OFFBOARDING.map((titulo) => ({ titulo, feito: false })),
                },
                "registrar o desligamento",
              );
              toast("Desligamento registrado. O colaborador passou para desligado.");
              fechar(d);
            } catch (err) {
              Object.assign(erro, { textContent: err.message, hidden: false });
            }
          },
        },
        bloco,
        h("div", { class: "field-grid" }, campo("Data do desligamento", data), campo("Tipo", tipo)),
        campo("Motivo declarado", motivo),
        h("label", { class: "consent" }, lamentada, h("span", { text: "Perda lamentada (a empresa gostaria de manter esta pessoa)" })),
        campo("Observações (confidencial)", obs),
        custo,
        erro,
        h("button", { type: "submit", class: "btn btn--primary" }, "Registrar desligamento"),
      );
    },
    { largo: true },
  );
}

async function gerarEntrevista(d) {
  const c = colaborador(d.colaborador_id);
  const p = await inserir("bp_pesquisas", { tipo: "offboarding", titulo: `Entrevista de desligamento · ${c?.nome ?? ""}`, descricao: "Obrigado pelo tempo conosco. Suas respostas são confidenciais e nos ajudam a melhorar a experiência de quem fica e de quem chega.", perguntas: ENTREVISTA_DESLIGAMENTO, anonima: false, colaborador_id: d.colaborador_id }, "gerar a entrevista");
  await atualizar("bp_desligamentos", d.id, { pesquisa_id: p.id }, "vincular a entrevista");
  return p;
}

export function criarOffboarding(app) {
  const raiz = h("section", { class: "modulo" });
  let aberto = null;

  async function detalhe(d) {
    const c = colaborador(d.colaborador_id);
    const p = pesquisaDe(d);
    const base = await urlPublica();
    const link = p && linkPublico(base, p.token);
    const s = statusEntrevista(d);
    const salvarChecklist = (item, valor) => {
      item.feito = valor;
      atualizar("bp_desligamentos", d.id, { checklist: d.checklist }, "salvar o checklist", { recarregar: false });
    };
    return h(
      "div",
      {},
      h("button", { type: "button", class: "btn-link voltar", onclick: () => { aberto = null; render(); } }, "← Desligamentos"),
      h("header", { class: "modulo__topo" }, h("p", { class: "eyebrow", text: "Offboarding" }), h("h1", { class: "title", text: c?.nome ?? "—" }), h("p", { class: "lead", text: [c?.cargo, c?.area, `Saída em ${I.fmtData(d.data)}`].filter(Boolean).join(" · ") }), barraAcoes(() => relatorioUm(d))),
      h("div", { class: "kpis" }, kpi("Tipo", I.TIPO_DESLIGAMENTO[d.tipo]?.nome ?? d.tipo), kpi("Tempo de casa", c ? I.tempoDeCasa(c) : "—"), kpi("Custo estimado", d.custo != null ? brl(Number(d.custo)) : "—"), kpi("Entrevista", s.nome, null, s.tom === "alerta" ? "alerta" : null)),
      h(
        "div",
        { class: "card" },
        h("h2", { text: "Entrevista de desligamento" }),
        d.entrevista
          ? h("dl", { class: "dados dados--coluna" }, ENTREVISTA_DESLIGAMENTO.map((q) => [h("dt", { text: q.texto }), h("dd", { text: resposta(q, d.entrevista[q.id]) })]))
          : link
            ? h(
                "div",
                {},
                h("p", { class: "hint", text: "Link de uso único: envie à pessoa ou abra e preencha junto com ela. A resposta volta para este registro." }),
                h("input", { value: link, readonly: true, "aria-label": "Link da entrevista", onfocus: (e) => e.target.select() }),
                h("div", { class: "actions" }, h("button", { type: "button", class: "btn btn--primary btn--auto", onclick: async () => { await navigator.clipboard.writeText(link); toast("Link copiado."); } }, icone("link"), "Copiar link"), h("a", { class: "btn btn--ghost", href: link, target: "_blank", rel: "noopener" }, "Abrir e conduzir"), h("button", { type: "button", class: "btn btn--ghost", onclick: async (e) => { e.currentTarget.disabled = true; await carregar(); render(); } }, "Verificar resposta")),
              )
            : p
              ? h("div", { class: "banner" }, "Configure o endereço da página pública em ", h("a", { href: "options.html", target: "_blank", text: "Configurações" }), ".")
              : h("button", { type: "button", class: "btn btn--primary", onclick: async () => { await gerarEntrevista(d); toast("Entrevista gerada."); render(); } }, "Gerar link da entrevista"),
      ),
      h(
        "div",
        { class: "card" },
        h("h2", { text: "Checklist de saída" }),
        h("ul", { class: "tarefas" }, (d.checklist ?? []).map((item) => h("li", {}, h("label", { class: "consent" }, h("input", { type: "checkbox", checked: item.feito, onchange: (e) => salvarChecklist(item, e.target.checked) }), h("span", { text: item.titulo }))))),
      ),
      d.custo_detalhe?.length
        ? h("details", { class: "card" }, h("summary", { text: `Custo estimado: ${brl(Number(d.custo))}` }), h("table", { class: "tabela" }, h("tbody", {}, d.custo_detalhe.map((i) => h("tr", {}, h("td", { text: i.rotulo }), h("td", { class: "num", text: brl(i.valor) }))))), h("p", { class: "hint", text: "Estimativa para gestão (verbas + reposição); não substitui o cálculo trabalhista." }))
        : null,
      d.observacoes ? h("div", { class: "card" }, h("h2", { text: "Observações" }), h("p", { text: d.observacoes })) : null,
      h(
        "div",
        { class: "actions" },
        h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => app.abrirPessoa(d.colaborador_id) }, "Ver ficha e histórico"),
        h("button", { type: "button", class: "btn btn--ghost btn--sm btn--danger", onclick: async () => { if (await confirmar("Excluir este registro? A pessoa volta ao quadro ativo.", "Excluir registro")) { await excluir("bp_desligamentos", d.id, "excluir o desligamento"); aberto = null; render(); } } }, "Excluir registro"),
      ),
    );
  }

  function lista() {
    const rel = relatorioOffboarding();
    return h(
      "div",
      {},
      cabecalhoModulo({ eyebrow: "Offboarding", titulo: "Offboarding", lead: "Registro do desligamento, checklist de saída, custo estimado e entrevista confidencial.", montar: relatorioOffboarding }),
      h("div", { class: "kpis" }, rel.kpis.slice(0, 4).map((k) => kpi(k.rotulo, k.valor, k.detalhe))),
      h("button", { type: "button", class: "btn btn--primary", onclick: async () => { const d = await registrar(); if (d) { aberto = d.id; render(); } } }, "Registrar desligamento"),
      rel.graficos[0].itens.length ? h("div", { class: "card" }, h("h2", { text: "O que pesou na saída" }), barras(rel.graficos[0].itens, { casas: 0, rotulo: "Fatores citados nas entrevistas" })) : null,
      rel.graficos[1].itens.some((i) => i.valor != null) ? h("div", { class: "card" }, h("h2", { text: "Experiência na empresa" }), barras(rel.graficos[1].itens.map((i) => ({ ...i, tom: i.valor != null && i.valor < 3 ? "perigo" : null })), { max: 5, rotulo: "Experiência na empresa, média de 1 a 5" })) : null,
      store.desligamentos.length
        ? h("ul", { class: "lista" }, store.desligamentos.map((d) => { const s = statusEntrevista(d); return h("li", {}, h("button", { type: "button", class: "linha-item", onclick: () => { aberto = d.id; render(); } }, h("span", { class: "linha-item__principal" }, h("strong", { text: nomeDe(d.colaborador_id) }), h("span", { class: "hint", text: `${I.fmtData(d.data)} · ${I.TIPO_DESLIGAMENTO[d.tipo]?.nome ?? d.tipo}` })), selo(s.nome, s.tom))); }))
        : vazio("Nenhum desligamento registrado."),
    );
  }

  async function render() {
    const d = aberto && store.desligamentos.find((x) => x.id === aberto);
    raiz.replaceChildren(d ? await detalhe(d) : lista());
  }

  async function registrarPara(colaboradorId) {
    render();
    const d = await registrar(colaboradorId);
    if (d) {
      aberto = d.id;
      render();
    }
  }

  return { raiz, render, voltar: () => (aberto = null), registrarPara };
}

