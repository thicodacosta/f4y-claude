/**
 * Produtividade e Cultura: as duas dimensões do Feedback 1:1 do JourneyLab
 * (8 critérios cada, notas de 1 a 5), agora avaliadas e acompanhadas em
 * funcionalidades separadas. Mesma régua de semáforo (≥ 4 bom · ≥ 3
 * acompanhar · < 3 atenção).
 */
import { cabecalhoModulo } from "../core/acoes.js";
import { excluir, inserir, nomeDe, store, colaborador } from "../core/db.js";
import * as I from "../core/indicadores.js";
import { barras, linha } from "../core/graficos.js";
import { campo, confirmar, h, kpi, modal, select, selo, toast, vazio, encher } from "../core/ui.js";
import { seletorColaborador } from "./pessoas.js";

const TEXTOS = {
  produtividade: { titulo: "Produtividade", lead: "Volume, qualidade, ferramentas, priorização, tempo, aprendizado, relacionamento e comunicação.", eyebrow: "Performance" },
  cultura: { titulo: "Cultura", lead: "Criatividade, confiança, resultado, senso de dono, adaptabilidade, resiliência, longo prazo e colaboração.", eyebrow: "Cultura e valores" },
};

export function relatorioAvaliacao(dim) {
  const ultimas = I.ultimasPorPessoa(store.avaliacoes, store.colaboradores, dim);
  const medias = [...ultimas.values()].map((a) => Number(a.media));
  const geral = medias.length ? medias.reduce((s, m) => s + m, 0) / medias.length : null;
  const cont = { sucesso: 0, alerta: 0, perigo: 0 };
  for (const m of medias) cont[I.semaforo(m).tom]++;
  const ativos = store.colaboradores.filter((c) => c.status === "ativo");
  const semAval = ativos.filter((c) => { const a = ultimas.get(c.id); return !a || I.diasEntre(a.data, I.hojeISO()) > 120; });
  const criterios = I.mediaPorCriterio(store.avaliacoes, store.colaboradores, dim);
  const meses = I.ultimosMeses(12);
  const serie = I.serieMensal(store, 12).map((m) => m[dim]);
  const proj = I.projetar(serie, 3, { min: 1, max: 5 });
  const fortes = criterios.filter((c) => c.media != null).sort((a, b) => b.media - a.media);
  const porArea = new Map();
  for (const [id, a] of ultimas) {
    const area = colaborador(id)?.area || "Sem área";
    porArea.set(area, [...(porArea.get(area) ?? []), Number(a.media)]);
  }
  return {
    modulo: dim,
    titulo: TEXTOS[dim].titulo,
    subtitulo: `${ultimas.size} de ${ativos.length} pessoas avaliadas · última avaliação de cada pessoa`,
    kpis: [
      { rotulo: "Média geral", valor: I.umaCasa(geral), detalhe: I.semaforo(geral).nome },
      { rotulo: "Bom (≥ 4)", valor: String(cont.sucesso), detalhe: medias.length ? I.pct((cont.sucesso / medias.length) * 100) : null },
      { rotulo: "Acompanhar (3 a 3,9)", valor: String(cont.alerta) },
      { rotulo: "Atenção (< 3)", valor: String(cont.perigo) },
      { rotulo: "Sem avaliação há 120+ dias", valor: String(semAval.length) },
    ],
    destaques: [
      fortes[0] ? `Critério mais forte: ${fortes[0].nome} (${I.umaCasa(fortes[0].media)})` : null,
      fortes.length > 1 ? `Critério que mais pede desenvolvimento: ${fortes.at(-1).nome} (${I.umaCasa(fortes.at(-1).media)}) — foco sugerido: ${fortes.at(-1).foco}.` : null,
      proj ? `Tendência para os próximos 3 meses: ${I.umaCasa(proj[2])} (projeção indicativa).` : null,
      semAval.length ? `${semAval.length} pessoa(s) sem avaliação recente.` : null,
    ].filter(Boolean),
    graficos: [
      { titulo: "Média por critério", tipo: "barras", max: 5, itens: criterios.map((c) => ({ rotulo: c.nome, valor: c.media })) },
      { titulo: "Evolução mensal da média", tipo: "linha", max: 5, itens: [...meses.map((m, i) => ({ rotulo: I.rotuloMes(m), valor: serie[i] })), ...(proj ?? []).map((v, i) => ({ rotulo: I.rotuloMes(I.proximosMeses(3)[i]), valor: v, projetado: true }))] },
      { titulo: "Média por área", tipo: "barras", max: 5, itens: [...porArea].map(([rotulo, v]) => ({ rotulo, valor: v.reduce((s, x) => s + x, 0) / v.length })) },
    ],
    tabelas: [{ titulo: "Última avaliação por pessoa", colunas: ["Pessoa", "Área", "Data", "Média", "Semáforo"], linhas: [...ultimas].map(([id, a]) => [nomeDe(id), colaborador(id)?.area ?? "—", I.fmtData(a.data), I.umaCasa(a.media), I.semaforo(Number(a.media)).nome]).sort((a, b) => a[3].localeCompare(b[3])) }],
  };
}

function formulario(dim, colaboradorId) {
  return modal(
    `Avaliar ${TEXTOS[dim].titulo}`,
    (fechar) => {
      const { sel, bloco } = seletorColaborador({ valor: colaboradorId ?? "" });
      const data = h("input", { type: "date", value: I.hojeISO(), max: I.hojeISO() });
      const avaliador = h("input", { placeholder: "Quem avaliou (opcional)" });
      const comentario = h("textarea", { rows: 3, placeholder: "Contexto, exemplos concretos e combinados" });
      const notas = {};
      const resumo = h("div", { class: "resumo-avaliacao", role: "status" });
      const atualizarResumo = () => {
        const m = I.mediaNotas(dim, notas);
        const faltam = I.CRITERIOS[dim].filter((c) => !notas[c.chave]).length;
        const baixos = I.CRITERIOS[dim].filter((c) => notas[c.chave] && notas[c.chave] <= 3);
        encher(resumo, 
          m == null ? h("span", { class: "hint", text: `Faltam ${faltam} critério(s).` }) : h("span", {}, "Média ", h("strong", { text: I.umaCasa(m) }), " ", selo(I.semaforo(m).nome, I.semaforo(m).tom)),
          baixos.length ? h("div", { class: "hint" }, "Focos sugeridos para o plano de ação: ", baixos.map((c) => c.foco).join("; "), ".") : null,
        );
      };
      const erro = h("p", { class: "error", hidden: true });
      const linhas = I.CRITERIOS[dim].map((c) =>
        h(
          "fieldset",
          { class: "criterio" },
          h("legend", {}, h("strong", { text: c.nome }), h("span", { class: "hint", text: ` — ${c.descricao}` })),
          h(
            "div",
            { class: "notas" },
            [1, 2, 3, 4, 5].map((n) =>
              h("label", { class: "nota", title: I.ESCALA[n] }, h("input", { type: "radio", name: `n-${c.chave}`, value: n, onchange: () => { notas[c.chave] = n; atualizarResumo(); } }), h("span", { text: String(n) })),
            ),
          ),
        ),
      );
      atualizarResumo();
      return h(
        "form",
        {
          novalidate: true,
          onsubmit: async (e) => {
            e.preventDefault();
            const media = I.mediaNotas(dim, notas);
            if (!sel.value) return Object.assign(erro, { textContent: "Escolha o colaborador.", hidden: false });
            if (media == null) return Object.assign(erro, { textContent: "Dê nota a todos os 8 critérios.", hidden: false });
            try {
              await inserir("bp_avaliacoes", { colaborador_id: sel.value, dimensao: dim, data: data.value || I.hojeISO(), notas, media: Math.round(media * 100) / 100, comentario: comentario.value.trim() || null, avaliador: avaliador.value.trim() || null }, "salvar a avaliação");
              toast("Avaliação salva no histórico do colaborador.");
              fechar(true);
            } catch (err) {
              Object.assign(erro, { textContent: err.message, hidden: false });
            }
          },
        },
        bloco,
        h("div", { class: "field-grid" }, campo("Data", data), campo("Avaliador(a)", avaliador)),
        h("p", { class: "hint", text: "1 Muito abaixo · 2 Abaixo · 3 Atende · 4 Acima · 5 Supera consistentemente" }),
        linhas,
        resumo,
        campo("Comentário", comentario),
        erro,
        h("button", { type: "submit", class: "btn btn--primary" }, "Salvar avaliação"),
      );
    },
    { largo: true },
  );
}

export function criarAvaliacao(dim, app) {
  const raiz = h("section", { class: "modulo" });
  let area = "";

  function render() {
    const rel = relatorioAvaliacao(dim);
    const ultimas = I.ultimasPorPessoa(store.avaliacoes, store.colaboradores, dim);
    const areas = [...new Set(store.colaboradores.map((c) => c.area).filter(Boolean))].sort();
    const pessoas = [...ultimas].filter(([id]) => !area || colaborador(id)?.area === area).sort((a, b) => Number(a[1].media) - Number(b[1].media));
    const meses = I.ultimosMeses(12);
    const serie = I.serieMensal(store, 12).map((m) => m[dim]);
    const proj = I.projetar(serie, 3, { min: 1, max: 5 });
    const recentes = store.avaliacoes.filter((a) => a.dimensao === dim).slice(0, 15);
    encher(raiz, 
      cabecalhoModulo({ eyebrow: TEXTOS[dim].eyebrow, titulo: TEXTOS[dim].titulo, lead: TEXTOS[dim].lead, montar: () => relatorioAvaliacao(dim) }),
      h("div", { class: "kpis" }, rel.kpis.slice(0, 4).map((k, i) => kpi(k.rotulo, k.valor, k.detalhe, i === 3 && k.valor !== "0" ? "perigo" : null))),
      h("button", { type: "button", class: "btn btn--primary", onclick: async () => { if (await formulario(dim)) render(); } }, `Nova avaliação de ${TEXTOS[dim].titulo}`),
      rel.destaques.length ? h("div", { class: "note" }, h("ul", { class: "list" }, rel.destaques.map((d) => h("li", { text: d })))) : null,
      ultimas.size
        ? [
            h("div", { class: "card" }, h("h2", { text: "Média por critério" }), barras(rel.graficos[0].itens.map((i) => ({ ...i, tom: i.valor != null && i.valor < 3 ? "perigo" : null })), { max: 5, rotulo: `Média por critério de ${TEXTOS[dim].titulo}` })),
            serie.some((v) => v != null) ? h("div", { class: "card" }, h("h2", { text: "Evolução e tendência" }), linha([{ nome: TEXTOS[dim].titulo, valores: serie, projecao: proj ?? [] }], meses.map(I.rotuloMes), { rotulosProjecao: proj ? I.proximosMeses(3).map(I.rotuloMes) : [], min: 1, max: 5, rotulo: `Evolução mensal de ${TEXTOS[dim].titulo}` })) : null,
          ]
        : vazio("Nenhuma avaliação ainda. Comece avaliando uma pessoa."),
      ultimas.size
        ? h(
            "div",
            { class: "card" },
            h("div", { class: "fase__topo" }, h("h2", { text: "Pessoas (última avaliação)" }), select([["", "Todas as áreas"], ...areas.map((a) => [a, a])], area, { "aria-label": "Filtrar por área", onchange: (e) => { area = e.target.value; render(); } })),
            h(
              "ul",
              { class: "lista lista--compacta" },
              pessoas.map(([id, a]) => {
                const s = I.semaforo(Number(a.media));
                return h("li", {}, h("button", { type: "button", class: "linha-item", onclick: () => app.abrirPessoa(id) }, h("span", { class: "linha-item__principal" }, h("strong", { text: nomeDe(id) }), h("span", { class: "hint", text: `${I.fmtData(a.data)} · ${colaborador(id)?.area ?? "—"}` })), h("span", { class: "nota-final", text: I.umaCasa(a.media) }), selo(s.nome, s.tom)));
              }),
            ),
          )
        : null,
      recentes.length
        ? h(
            "details",
            { class: "card" },
            h("summary", { text: "Avaliações recentes" }),
            h(
              "ul",
              { class: "lista lista--compacta" },
              recentes.map((a) =>
                h(
                  "li",
                  { class: "linha-item linha-item--estatica" },
                  h("span", { class: "linha-item__principal" }, h("strong", { text: nomeDe(a.colaborador_id) }), h("span", { class: "hint", text: `${I.fmtData(a.data)}${a.avaliador ? ` · por ${a.avaliador}` : ""}${a.comentario ? ` · “${a.comentario.slice(0, 80)}”` : ""}` })),
                  h("span", { class: "nota-final", text: I.umaCasa(a.media) }),
                  h("button", { type: "button", class: "btn-link btn--danger", "aria-label": "Excluir avaliação", onclick: async () => { if (await confirmar("Excluir esta avaliação? O evento continua no histórico.", "Excluir")) { await excluir("bp_avaliacoes", a.id, "excluir a avaliação"); render(); } } }, "Excluir"),
                ),
              ),
            ),
          )
        : null,
    );
  }

  async function avaliar(colaboradorId) {
    render();
    if (await formulario(dim, colaboradorId)) render();
  }

  return { raiz, render, avaliar };
}
