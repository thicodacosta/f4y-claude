/**
 * Onboarding 30/60/90 (base: Onboarding v2 do JourneyLab): fases com marco,
 * tarefas por responsável, progresso e conclusão automáticos, alerta de fase
 * atrasada.
 */
import { cabecalhoModulo, barraAcoes } from "../core/acoes.js";
import { atualizar, excluir, inserir, nomeDe, store, colaborador } from "../core/db.js";
import * as I from "../core/indicadores.js";
import { barras } from "../core/graficos.js";
import { campo, confirmar, h, kpi, modal, select, selo, toast, vazio } from "../core/ui.js";
import { formularioColaborador, seletorColaborador } from "./pessoas.js";

function situacao(o) {
  if (o.status === "concluido") return { nome: "Concluído", tom: "sucesso" };
  if (o.status === "cancelado") return { nome: "Cancelado", tom: "neutro" };
  if (I.onboardingAtrasado(o)) return { nome: "Fase atrasada", tom: "perigo" };
  return { nome: `Dia ${I.diaDoOnboarding(o)} de 90`, tom: "alerta" };
}

export function relatorioOnboarding() {
  const lista = store.onboardings;
  const andamento = lista.filter((o) => o.status === "em_andamento");
  const concluidos = lista.filter((o) => o.status === "concluido");
  const atrasados = andamento.filter((o) => I.onboardingAtrasado(o));
  const duracoes = concluidos.filter((o) => o.concluido_em).map((o) => I.diasEntre(o.inicio, o.concluido_em.slice(0, 10)));
  // Tarefas mais atrasadas: as que mais aparecem em aberto depois do marco.
  const pendentes = new Map();
  for (const o of andamento) for (const f of o.fases) if (I.somarDias(o.inicio, f.marco) < I.hojeISO()) for (const t of f.tarefas) if (!t.feita) pendentes.set(t.titulo, (pendentes.get(t.titulo) ?? 0) + 1);
  return {
    modulo: "onboarding",
    titulo: "Onboarding 30/60/90",
    subtitulo: `${andamento.length} em andamento · ${concluidos.length} concluídos`,
    kpis: [
      { rotulo: "Em andamento", valor: String(andamento.length) },
      { rotulo: "Com fase atrasada", valor: String(atrasados.length), detalhe: andamento.length ? I.pct((atrasados.length / andamento.length) * 100) : null },
      { rotulo: "Progresso médio", valor: andamento.length ? I.pct(andamento.reduce((s, o) => s + o.progresso, 0) / andamento.length) : "—" },
      { rotulo: "Concluídos", valor: String(concluidos.length) },
      { rotulo: "Tempo médio de conclusão", valor: duracoes.length ? `${Math.round(duracoes.reduce((s, d) => s + d, 0) / duracoes.length)} dias` : "—" },
    ],
    destaques: [
      atrasados.length ? `${atrasados.length} onboarding(s) com fase atrasada: ${atrasados.map((o) => nomeDe(o.colaborador_id)).join(", ")}.` : "Nenhum onboarding com fase atrasada.",
      ...[...pendentes].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `Tarefa que mais atrasa: "${t}" (${n})`),
    ],
    graficos: [{ titulo: "Progresso por pessoa (em andamento)", tipo: "barras", max: 100, sufixo: "%", casas: 0, itens: andamento.map((o) => ({ rotulo: nomeDe(o.colaborador_id), valor: o.progresso })) }],
    tabelas: [{ titulo: "Onboardings", colunas: ["Pessoa", "Início", "Progresso", "Situação"], linhas: lista.map((o) => [nomeDe(o.colaborador_id), I.fmtData(o.inicio), `${o.progresso}%`, situacao(o).nome]) }],
  };
}

function relatorioUm(o) {
  const c = colaborador(o.colaborador_id);
  return {
    modulo: "onboarding",
    colaboradorId: o.colaborador_id,
    titulo: `Onboarding · ${c?.nome ?? ""}`,
    subtitulo: [c?.cargo, c?.area, `Início em ${I.fmtData(o.inicio)}`].filter(Boolean).join(" · "),
    kpis: [{ rotulo: "Progresso", valor: `${o.progresso}%` }, { rotulo: "Situação", valor: situacao(o).nome }, { rotulo: "Dia", valor: String(I.diaDoOnboarding(o)) }],
    graficos: [{ titulo: "Progresso por fase", tipo: "barras", max: 100, sufixo: "%", casas: 0, itens: o.fases.map((f) => ({ rotulo: f.titulo, valor: Math.round((f.tarefas.filter((t) => t.feita).length / Math.max(1, f.tarefas.length)) * 100) })) }],
    tabelas: o.fases.map((f) => ({ titulo: `${f.titulo} (até o dia ${f.marco})`, colunas: ["Tarefa", "Responsável", "Situação"], linhas: f.tarefas.map((t) => [t.titulo, I.RESPONSAVEL[t.responsavel], t.feita ? `Feita em ${I.fmtData(t.feitaEm)}` : "Pendente"]) })),
  };
}

async function novoOnboarding(colaboradorId) {
  return modal("Iniciar onboarding", (fechar) => {
    const semOnb = (c) => c.status === "ativo" && !store.onboardings.some((o) => o.colaborador_id === c.id && o.status !== "cancelado");
    const { sel, bloco } = seletorColaborador({ filtro: semOnb, valor: colaboradorId ?? "" });
    const inicio = h("input", { type: "date", value: colaborador(colaboradorId)?.admissao ?? I.hojeISO() });
    const erro = h("p", { class: "error", hidden: true });
    return h(
      "form",
      {
        onsubmit: async (e) => {
          e.preventDefault();
          if (!sel.value) return Object.assign(erro, { textContent: "Escolha o colaborador.", hidden: false });
          try {
            const o = await inserir("bp_onboardings", { colaborador_id: sel.value, inicio: inicio.value || I.hojeISO(), fases: I.novasFases() }, "iniciar o onboarding");
            toast("Onboarding iniciado com o modelo 30/60/90.");
            fechar(o);
          } catch (err) {
            Object.assign(erro, { textContent: err.message, hidden: false });
          }
        },
      },
      bloco,
      h("button", { type: "button", class: "btn-link", onclick: async () => { const c = await formularioColaborador(); if (c) { sel.append(h("option", { value: c.id, selected: true }, c.nome)); inicio.value = c.admissao ?? inicio.value; } } }, "+ Cadastrar novo colaborador"),
      campo("Início (dia 1)", inicio, "As fases vencem nos dias 30, 60 e 90 a partir desta data."),
      h("div", { class: "note" }, h("p", { class: "note__title", text: "Modelo 30/60/90" }), h("ul", { class: "list" }, I.MODELO_ONBOARDING.map((f) => h("li", { text: `${f.titulo} — ${f.tarefas.length} tarefas até o dia ${f.marco}` })))),
      erro,
      h("button", { type: "submit", class: "btn btn--primary" }, "Iniciar onboarding"),
    );
  });
}

export function criarOnboarding(app) {
  const raiz = h("section", { class: "modulo" });
  let aberto = null;
  let filtro = "em_andamento";

  // Salvamentos em fila: cliques rápidos nas tarefas não se sobrepõem, e o
  // estado local (fases) segue sendo a fonte da verdade da tela.
  let fila = Promise.resolve();
  function salvarFases(o) {
    const progresso = I.progressoOnboarding(o.fases);
    o.progresso = progresso;
    render();
    fila = fila.then(async () => {
      const concluido = progresso === 100;
      const mudaStatus = (concluido && o.status === "em_andamento") || (!concluido && o.status === "concluido");
      const campos = { fases: o.fases, progresso, ...(mudaStatus ? (concluido ? { status: "concluido", concluido_em: new Date().toISOString() } : { status: "em_andamento", concluido_em: null }) : {}) };
      try {
        const salvo = await atualizar("bp_onboardings", o.id, campos, "salvar o onboarding", { recarregar: mudaStatus });
        if (!mudaStatus) Object.assign(o, { status: salvo.status, concluido_em: salvo.concluido_em });
        if (mudaStatus && concluido) toast("Onboarding concluído. Registrado no histórico.");
      } catch (e) {
        toast(e.message);
      }
    });
    return fila;
  }

  function detalhe(o) {
    const c = colaborador(o.colaborador_id);
    const novaTarefa = (fase) => async () => {
      const titulo = await modal("Nova tarefa", (fechar) => {
        const t = h("input", { required: true });
        const r = select(Object.entries(I.RESPONSAVEL), "gestor");
        return h("form", { onsubmit: (e) => { e.preventDefault(); if (t.value.trim()) fechar({ titulo: t.value.trim(), responsavel: r.value }); } }, campo("Tarefa", t), campo("Responsável", r), h("button", { type: "submit", class: "btn btn--primary" }, "Adicionar"));
      });
      if (!titulo) return;
      fase.tarefas.push({ id: `${fase.id}x${Date.now().toString(36)}`, ...titulo, feita: false, feitaEm: null });
      salvarFases(o);
    };
    return h(
      "div",
      {},
      h("button", { type: "button", class: "btn-link voltar", onclick: () => { aberto = null; render(); } }, "← Onboardings"),
      h("header", { class: "modulo__topo" }, h("p", { class: "eyebrow", text: "Onboarding 30/60/90" }), h("h1", { class: "title", text: c?.nome ?? "—" }), h("p", { class: "lead", text: [c?.cargo, c?.area, `Início em ${I.fmtData(o.inicio)}`].filter(Boolean).join(" · ") }), barraAcoes(() => relatorioUm(o))),
      h("div", { class: "kpis" }, kpi("Progresso", `${o.progresso}%`), kpi("Situação", situacao(o).nome, null, situacao(o).tom), kpi("Dia", String(I.diaDoOnboarding(o)))),
      h("div", { class: "progresso", role: "progressbar", "aria-valuenow": o.progresso, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": "Progresso do onboarding" }, h("span", { style: { width: `${o.progresso}%` } })),
      o.fases.map((f) => {
        const s = I.situacaoFase(o, f);
        return h(
          "div",
          { class: "card fase" },
          h("div", { class: "fase__topo" }, h("h2", { text: f.titulo }), selo(s.nome, s.tom)),
          h(
            "ul",
            { class: "tarefas" },
            f.tarefas.map((t) =>
              h(
                "li",
                {},
                h(
                  "label",
                  { class: "consent" },
                  h("input", {
                    type: "checkbox",
                    checked: t.feita,
                    disabled: o.status === "cancelado",
                    onchange: (e) => {
                      t.feita = e.target.checked;
                      t.feitaEm = t.feita ? I.hojeISO() : null;
                      salvarFases(o);
                    },
                  }),
                  h("span", {}, t.titulo, h("span", { class: "hint tarefa__meta", text: ` · ${I.RESPONSAVEL[t.responsavel]}${t.feita ? ` · feita em ${I.fmtData(t.feitaEm)}` : ""}` })),
                ),
              ),
            ),
          ),
          o.status !== "cancelado" ? h("button", { type: "button", class: "btn-link", onclick: novaTarefa(f) }, "+ Tarefa") : null,
        );
      }),
      h(
        "div",
        { class: "actions" },
        h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => app.abrirPessoa(o.colaborador_id) }, "Ver ficha e histórico"),
        o.status === "em_andamento"
          ? h("button", { type: "button", class: "btn btn--ghost btn--sm btn--danger", onclick: async () => { if (await confirmar("Cancelar este onboarding?", "Cancelar onboarding")) { await atualizar("bp_onboardings", o.id, { status: "cancelado" }, "cancelar o onboarding"); render(); } } }, "Cancelar onboarding")
          : h("button", { type: "button", class: "btn btn--ghost btn--sm btn--danger", onclick: async () => { if (await confirmar("Excluir este onboarding? O histórico do colaborador mantém os eventos já registrados.", "Excluir")) { await excluir("bp_onboardings", o.id, "excluir o onboarding"); aberto = null; render(); } } }, "Excluir"),
      ),
    );
  }

  function lista() {
    const rel = relatorioOnboarding();
    const itens = store.onboardings.filter((o) => filtro === "todos" || o.status === filtro);
    const andamento = store.onboardings.filter((o) => o.status === "em_andamento");
    return h(
      "div",
      {},
      cabecalhoModulo({ eyebrow: "Onboarding", titulo: "Onboarding 30/60/90", lead: "Fases com marco, tarefas por responsável e conclusão automática.", montar: relatorioOnboarding }),
      h("div", { class: "kpis" }, rel.kpis.slice(0, 4).map((k) => kpi(k.rotulo, k.valor, k.detalhe, k.rotulo.includes("atrasada") && k.valor !== "0" ? "perigo" : null))),
      h("button", { type: "button", class: "btn btn--primary", onclick: async () => { const o = await novoOnboarding(); if (o) { aberto = o.id; render(); } } }, "Iniciar onboarding"),
      andamento.length ? h("div", { class: "card" }, h("h2", { text: "Progresso" }), barras(andamento.map((o) => ({ rotulo: nomeDe(o.colaborador_id), valor: o.progresso, tom: I.onboardingAtrasado(o) ? "perigo" : null })), { max: 100, casas: 0, sufixo: "%", rotulo: "Progresso dos onboardings em andamento" })) : null,
      h("div", { class: "filtros" }, select([["em_andamento", "Em andamento"], ["concluido", "Concluídos"], ["cancelado", "Cancelados"], ["todos", "Todos"]], filtro, { "aria-label": "Situação", onchange: (e) => { filtro = e.target.value; render(); } })),
      itens.length
        ? h("ul", { class: "lista" }, itens.map((o) => { const s = situacao(o); return h("li", {}, h("button", { type: "button", class: "linha-item", onclick: () => { aberto = o.id; render(); } }, h("span", { class: "linha-item__principal" }, h("strong", { text: nomeDe(o.colaborador_id) }), h("span", { class: "hint", text: `Início ${I.fmtData(o.inicio)} · ${o.progresso}%` })), selo(s.nome, s.tom))); }))
        : vazio("Nenhum onboarding nesta situação."),
    );
  }

  function render() {
    const o = aberto && store.onboardings.find((x) => x.id === aberto);
    raiz.replaceChildren(o ? detalhe(o) : lista());
  }

  async function abrirPara(colaboradorId) {
    const existente = store.onboardings.find((o) => o.colaborador_id === colaboradorId && o.status !== "cancelado");
    if (existente) aberto = existente.id;
    else {
      const o = await novoOnboarding(colaboradorId);
      if (o) aberto = o.id;
    }
    render();
  }

  return { raiz, render, voltar: () => (aberto = null), abrirPara };
}
