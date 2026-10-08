/**
 * Pessoas: base de colaboradores e a ficha de cada um, com a linha do tempo
 * completa (bp_historico, escrita pelos gatilhos do banco a cada cadastro,
 * avaliação, onboarding, resposta, desligamento e documento gerado).
 */
import { cabecalhoModulo, barraAcoes } from "../core/acoes.js";
import { anotar, atualizar, colaborador, excluir, historico, inserir, inserirVarios, store } from "../core/db.js";
import * as I from "../core/indicadores.js";
import { linha } from "../core/graficos.js";
import { FriendlyError, formatBRL, normalize } from "../core/toolskit.js";
import { formatarTelefone, linkWhatsapp, normalizarTelefone } from "../core/importacao.js";
import { importador } from "./colaboradores-config.js";
import { campo, confirmar, h, kpi, modal, select, selo, toast, vazio } from "../core/ui.js";

const VINCULOS = [["clt", "CLT"], ["pj", "PJ"], ["estagio", "Estágio"], ["outro", "Outro"]];
const MODULO_ROTULO = { pessoas: "Cadastro", onboarding: "Onboarding", produtividade: "Produtividade", cultura: "Cultura", pulso: "Pulso", offboarding: "Offboarding", anotacao: "Anotação", gestao: "Gestão", turnover: "Turnover" };

/** Formulário de colaborador (novo ou edição). Devolve a linha salva ou null. */
export function formularioColaborador(atual = null) {
  return modal(atual ? "Editar colaborador" : "Novo colaborador", (fechar) => {
    const f = {
      nome: h("input", { value: atual?.nome ?? "", required: true, autocomplete: "off" }),
      email: h("input", { type: "email", value: atual?.email ?? "", autocomplete: "off" }),
      telefone: h("input", { type: "tel", value: formatarTelefone(atual?.telefone), autocomplete: "off", placeholder: "(11) 98765-4321" }),
      cargo: h("input", { value: atual?.cargo ?? "" }),
      area: h("input", { value: atual?.area ?? "", list: "lista-areas" }),
      gestor: h("input", { value: atual?.gestor ?? "", list: "lista-gestores" }),
      vinculo: select(VINCULOS, atual?.vinculo ?? "clt"),
      salario: h("input", { type: "number", min: "0", step: "100", value: atual?.salario ?? "" }),
      admissao: h("input", { type: "date", value: atual?.admissao ?? I.hojeISO() }),
    };
    const areas = [...new Set(store.colaboradores.map((c) => c.area).filter(Boolean))];
    const gestores = [...new Set(store.colaboradores.map((c) => c.gestor).filter(Boolean))];
    const erro = h("p", { class: "error", role: "alert", hidden: true });
    const salvar = h("button", { type: "submit", class: "btn btn--primary" }, "Salvar");
    return h(
      "form",
      {
        novalidate: true,
        onsubmit: async (e) => {
          e.preventDefault();
          const tel = normalizarTelefone(f.telefone.value);
          if (tel.erro) return Object.assign(erro, { textContent: tel.erro, hidden: false });
          const linhaDados = {
            telefone: tel.valor,
            nome: f.nome.value.trim(),
            email: f.email.value.trim().toLowerCase() || null,
            cargo: f.cargo.value.trim() || null,
            area: f.area.value.trim() || null,
            gestor: f.gestor.value.trim() || null,
            vinculo: f.vinculo.value,
            salario: f.salario.value ? Number(f.salario.value) : null,
            admissao: f.admissao.value || null,
          };
          if (!linhaDados.nome) return Object.assign(erro, { textContent: "Informe o nome.", hidden: false });
          salvar.disabled = true;
          try {
            const salvo = atual ? await atualizar("bp_colaboradores", atual.id, linhaDados, "salvar o colaborador") : await inserir("bp_colaboradores", linhaDados, "salvar o colaborador");
            toast(atual ? "Cadastro atualizado." : "Colaborador cadastrado.");
            fechar(salvo);
          } catch (err) {
            Object.assign(erro, { textContent: err instanceof FriendlyError ? err.message : "Não foi possível salvar.", hidden: false });
            salvar.disabled = false;
          }
        },
      },
      campo("Nome completo", f.nome),
      h("div", { class: "field-grid" }, campo("E-mail", f.email, "Liga respostas identificadas do Pulso ao histórico."), campo("Telefone (com DDD)", f.telefone), campo("Cargo", f.cargo), campo("Área", f.area), campo("Gestor(a)", f.gestor), campo("Vínculo", f.vinculo), campo("Remuneração mensal (R$)", f.salario, "Usada no custo de turnover."), campo("Admissão", f.admissao)),
      h("datalist", { id: "lista-areas" }, areas.map((a) => h("option", { value: a }))),
      h("datalist", { id: "lista-gestores" }, gestores.map((g) => h("option", { value: g }))),
      erro,
      salvar,
    );
  });
}

/** Seletor de colaborador ativo (com opção de cadastrar na hora). */
export function seletorColaborador({ filtro = (c) => c.status === "ativo", valor = "", rotulo = "Colaborador" } = {}) {
  const lista = store.colaboradores.filter(filtro);
  const sel = select([["", lista.length ? "Escolha…" : "Nenhum colaborador cadastrado"], ...lista.map((c) => [c.id, `${c.nome}${c.cargo ? ` · ${c.cargo}` : ""}`])], valor);
  return { sel, bloco: campo(rotulo, sel) };
}

// ─── Importação em massa (mesma das Configurações) ─────────────────────────

function importarPlanilha() {
  return modal("Importar colaboradores", (fechar) => importador({ aoConcluir: () => setTimeout(() => fechar(true), 1200) }), { largo: true });
}

// ─── Relatório de uma pessoa ───────────────────────────────────────────────

export function relatorioPessoa(c, eventos = []) {
  const prod = I.avaliacoesDe(store.avaliacoes, c.id, "produtividade");
  const cult = I.avaliacoesDe(store.avaliacoes, c.id, "cultura");
  const onb = store.onboardings.find((o) => o.colaborador_id === c.id);
  const desl = store.desligamentos.find((d) => d.colaborador_id === c.id);
  const risco = c.status === "ativo" ? I.riscos(store).find((r) => r.colaborador.id === c.id) : null;
  const ult = (lista) => lista[0] ? I.umaCasa(lista[0].media) : "—";
  const ultCrit = (lista, dim) => (lista[0] ? I.CRITERIOS[dim].map((k) => ({ rotulo: k.nome, valor: lista[0].notas[k.chave] })) : []);
  return {
    modulo: "pessoas",
    colaboradorId: c.id,
    titulo: c.nome,
    subtitulo: [c.cargo, c.area, c.gestor ? `Gestão: ${c.gestor}` : null].filter(Boolean).join(" · "),
    kpis: [
      { rotulo: "Tempo de casa", valor: I.tempoDeCasa(c), detalhe: c.admissao ? `Admissão em ${I.fmtData(c.admissao)}` : null },
      { rotulo: "Produtividade", valor: ult(prod), detalhe: prod[0] ? `${I.semaforo(Number(prod[0].media)).nome} · ${I.fmtData(prod[0].data)}` : "Sem avaliação" },
      { rotulo: "Cultura", valor: ult(cult), detalhe: cult[0] ? `${I.semaforo(Number(cult[0].media)).nome} · ${I.fmtData(cult[0].data)}` : "Sem avaliação" },
      { rotulo: "Onboarding", valor: onb ? `${onb.progresso}%` : "—", detalhe: onb ? (onb.status === "concluido" ? "Concluído" : "Em andamento") : "Sem registro" },
      { rotulo: c.status === "ativo" ? "Risco de saída (indicativo)" : "Status", valor: c.status === "ativo" ? `${risco?.pontos ?? 0} pts` : "Desligado(a)", detalhe: c.status === "ativo" ? I.NIVEL[risco?.nivel ?? "baixo"].nome : desl ? I.fmtData(desl.data) : null },
    ],
    destaques: [
      ...(risco?.fatores ?? []).map((f) => `${f.texto} (+${f.pontos})`),
      desl ? `Desligamento: ${I.TIPO_DESLIGAMENTO[desl.tipo]?.nome ?? desl.tipo}${desl.motivo ? ` · ${I.MOTIVOS[desl.motivo] ?? desl.motivo}` : ""}` : null,
    ].filter(Boolean),
    graficos: [
      { titulo: "Produtividade — última avaliação por critério", tipo: "barras", itens: ultCrit(prod, "produtividade"), max: 5, casas: 0 },
      { titulo: "Cultura — última avaliação por critério", tipo: "barras", itens: ultCrit(cult, "cultura"), max: 5, casas: 0 },
      { titulo: "Evolução da Produtividade", tipo: "linha", itens: [...prod].reverse().map((a) => ({ rotulo: I.fmtData(a.data), valor: Number(a.media) })), max: 5 },
    ].filter((g) => g.itens.length),
    tabelas: [{ titulo: "Histórico", colunas: ["Data", "Área", "Evento"], linhas: eventos.map((e) => [I.fmtDataHora(e.criado_em), MODULO_ROTULO[e.modulo] ?? e.modulo, e.resumo]) }],
    textos: [
      prod[0]?.comentario ? { titulo: "Comentário — Produtividade", texto: prod[0].comentario } : null,
      cult[0]?.comentario ? { titulo: "Comentário — Cultura", texto: cult[0].comentario } : null,
    ].filter(Boolean),
  };
}

// ─── Tela ──────────────────────────────────────────────────────────────────

export function criarPessoas(app) {
  const raiz = h("section", { class: "modulo" });
  let busca = "";
  let filtro = "ativo";
  let aberta = null; // id da ficha aberta

  function montarLista() {
    const ativos = store.colaboradores.filter((c) => c.status === "ativo");
    return {
      modulo: "pessoas",
      titulo: "Quadro de colaboradores",
      subtitulo: `${ativos.length} ativos · ${store.colaboradores.length - ativos.length} desligados`,
      kpis: [
        { rotulo: "Ativos", valor: String(ativos.length) },
        { rotulo: "Áreas", valor: String(new Set(ativos.map((c) => c.area).filter(Boolean)).size) },
        { rotulo: "Tempo médio de casa", valor: ativos.length ? `${I.umaCasa(ativos.reduce((s, c) => s + (I.mesesDeCasa(c) ?? 0), 0) / ativos.length / 12)} anos` : "—" },
      ],
      graficos: [{ titulo: "Pessoas por área", tipo: "barras", casas: 0, itens: [...ativos.reduce((m, c) => m.set(c.area || "Sem área", (m.get(c.area || "Sem área") ?? 0) + 1), new Map())].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor) }],
      tabelas: [{ titulo: "Colaboradores", colunas: ["Nome", "Cargo", "Área", "Gestor", "Admissão", "Status"], linhas: store.colaboradores.map((c) => [c.nome, c.cargo ?? "—", c.area ?? "—", c.gestor ?? "—", I.fmtData(c.admissao), c.status]) }],
    };
  }

  function lista() {
    const termos = normalize(busca).split(/\s+/).filter(Boolean);
    const pessoas = store.colaboradores.filter((c) => (filtro === "todos" || c.status === filtro) && termos.every((t) => normalize(`${c.nome} ${c.cargo ?? ""} ${c.area ?? ""} ${c.gestor ?? ""}`).includes(t)));
    const riscos = new Map(I.riscos(store).map((r) => [r.colaborador.id, r]));
    const campoBusca = h("input", { type: "search", placeholder: "Buscar por nome, cargo, área ou gestor", value: busca, "aria-label": "Buscar colaboradores", oninput: (e) => { busca = e.target.value; render(true); } });
    return h(
      "div",
      {},
      cabecalhoModulo({ eyebrow: "Pessoas", titulo: "Colaboradores", lead: "Base única da empresa. Cada ficha guarda o histórico completo da pessoa em todos os módulos.", montar: montarLista }),
      h(
        "div",
        { class: "acoes-linha" },
        h("button", { type: "button", class: "btn btn--primary btn--auto", onclick: async () => { const c = await formularioColaborador(); if (c) abrir(c.id); } }, "Novo colaborador"),
        h("button", { type: "button", class: "btn btn--ghost", onclick: importarPlanilha }, "Importar planilha"),
      ),
      h("div", { class: "filtros" }, campoBusca, select([["ativo", "Ativos"], ["desligado", "Desligados"], ["todos", "Todos"]], filtro, { "aria-label": "Situação", onchange: (e) => { filtro = e.target.value; render(); } })),
      pessoas.length
        ? h(
            "ul",
            { class: "lista" },
            pessoas.map((c) => {
              const r = riscos.get(c.id);
              return h(
                "li",
                {},
                h(
                  "button",
                  { type: "button", class: "linha-item", onclick: () => abrir(c.id) },
                  h("span", { class: "linha-item__principal" }, h("strong", { text: c.nome }), h("span", { class: "hint", text: [c.cargo, c.area].filter(Boolean).join(" · ") || "—" })),
                  c.status === "ativo" ? selo(I.NIVEL[r?.nivel ?? "baixo"].nome.replace("Risco ", "Risco "), I.NIVEL[r?.nivel ?? "baixo"].tom) : selo("Desligado(a)", "neutro"),
                ),
              );
            }),
          )
        : vazio(store.colaboradores.length ? "Nenhum colaborador com esse filtro." : "Cadastre o primeiro colaborador ou importe uma planilha."),
    );
  }

  async function ficha(id) {
    const c = colaborador(id);
    if (!c) {
      aberta = null;
      return lista();
    }
    const eventos = await historico(id).catch(() => []);
    const rel = relatorioPessoa(c, eventos);
    const prod = [...I.avaliacoesDe(store.avaliacoes, c.id, "produtividade")].reverse();
    const cult = [...I.avaliacoesDe(store.avaliacoes, c.id, "cultura")].reverse();
    const nota = h("textarea", { rows: 2, placeholder: "Registrar uma anotação no histórico (conversa, combinado, reconhecimento…)" });
    const linhaTempo = h(
      "ol",
      { class: "timeline" },
      eventos.length
        ? eventos.map((e) => h("li", { class: `timeline__item timeline__item--${e.modulo}` }, h("span", { class: "timeline__quando", text: `${I.fmtDataHora(e.criado_em)} · ${MODULO_ROTULO[e.modulo] ?? e.modulo}` }), h("span", { text: e.resumo })))
        : h("li", { class: "hint", text: "Sem eventos ainda." }),
    );
    const datas = [...new Set([...prod, ...cult].map((a) => a.data))].sort();
    const grafico =
      datas.length >= 2
        ? linha(
            [
              { nome: "Produtividade", valores: datas.map((d) => prod.find((a) => a.data === d)?.media ?? null).map((v) => (v == null ? null : Number(v))) },
              { nome: "Cultura", valores: datas.map((d) => cult.find((a) => a.data === d)?.media ?? null).map((v) => (v == null ? null : Number(v))) },
            ],
            datas.map((d) => I.fmtData(d).slice(0, 5)),
            { min: 1, max: 5, rotulo: "Evolução das médias de Produtividade e Cultura" },
          )
        : null;
    return h(
      "div",
      {},
      h("button", { type: "button", class: "btn-link voltar", onclick: () => { aberta = null; render(); } }, "← Colaboradores"),
      h("header", { class: "modulo__topo" }, h("p", { class: "eyebrow", text: "Ficha do colaborador" }), h("h1", { class: "title", text: c.nome }), h("p", { class: "lead", text: rel.subtitulo || "—" }), barraAcoes(() => relatorioPessoa(c, eventos))),
      h("div", { class: "kpis" }, rel.kpis.map((k) => kpi(k.rotulo, k.valor, k.detalhe))),
      rel.destaques.length ? h("div", { class: "card" }, h("h2", { text: "Sinais de atenção" }), h("ul", { class: "list" }, rel.destaques.map((d) => h("li", { text: d }))), h("p", { class: "hint", text: "Indicativo, para priorizar conversas e ações. Nunca use para decidir sobre a pessoa." })) : null,
      grafico ? h("div", { class: "card" }, h("h2", { text: "Evolução das avaliações" }), grafico) : null,
      h(
        "div",
        { class: "card" },
        h("h2", { text: "Dados cadastrais" }),
        h(
          "dl",
          { class: "dados" },
          [["E-mail", c.email], ["Telefone", c.telefone ? h("a", { href: linkWhatsapp(c.telefone), target: "_blank", rel: "noopener", text: `${formatarTelefone(c.telefone)} · WhatsApp` }) : null], ["Vínculo", VINCULOS.find(([v]) => v === c.vinculo)?.[1]], ["Remuneração", c.salario ? formatBRL(Number(c.salario)) : null], ["Admissão", I.fmtData(c.admissao)], ["Desligamento", c.desligamento ? I.fmtData(c.desligamento) : null]]
            .filter(([, v]) => v)
            .map(([k, v]) => [h("dt", { text: k }), h("dd", {}, v)]),
        ),
        h(
          "div",
          { class: "actions" },
          h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => formularioColaborador(c) }, "Editar"),
          c.status === "ativo" ? h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => app.ir("produtividade", { colaboradorId: c.id }) }, "Avaliar") : null,
          c.status === "ativo" && !store.onboardings.some((o) => o.colaborador_id === c.id) ? h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => app.ir("onboarding", { colaboradorId: c.id }) }, "Iniciar onboarding") : null,
          c.status === "ativo" ? h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => app.ir("offboarding", { colaboradorId: c.id }) }, "Registrar desligamento") : null,
          h(
            "button",
            {
              type: "button",
              class: "btn btn--ghost btn--sm btn--danger",
              onclick: async () => {
                if (!(await confirmar(`Excluir ${c.nome} e TODO o histórico dessa pessoa (avaliações, onboarding, desligamento)? Não dá para desfazer.`, "Excluir"))) return;
                await excluir("bp_colaboradores", c.id, "excluir o colaborador");
                aberta = null;
                toast("Colaborador excluído.");
              },
            },
            "Excluir",
          ),
        ),
      ),
      h(
        "div",
        { class: "card" },
        h("h2", { text: "Histórico" }),
        h(
          "form",
          {
            class: "anotacao",
            onsubmit: async (e) => {
              e.preventDefault();
              if (!nota.value.trim()) return;
              try {
                await anotar(c.id, nota.value.trim());
                toast("Anotação registrada.");
                render();
              } catch (err) {
                toast(err.message);
              }
            },
          },
          nota,
          h("button", { type: "submit", class: "btn btn--ghost btn--sm" }, "Anotar"),
        ),
        linhaTempo,
      ),
    );
  }

  function abrir(id) {
    aberta = id;
    render();
  }

  async function render(manterFoco = false) {
    const foco = manterFoco ? document.activeElement?.type === "search" : false;
    const pos = foco ? document.activeElement.selectionStart : 0;
    raiz.replaceChildren(aberta ? await ficha(aberta) : lista());
    if (foco) {
      const s = raiz.querySelector('input[type="search"]');
      s?.focus();
      s?.setSelectionRange(pos, pos);
    }
  }

  return { raiz, render, voltar: () => (aberta = null), abrir };
}
