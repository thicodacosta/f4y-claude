/**
 * Gestão: o cenário de agora, o histórico de 12 meses e a projeção dos
 * próximos 6 (tendência linear + risco de saída). A análise preditiva com IA
 * lê o mesmo relatório e devolve leitura executiva, riscos e recomendações;
 * cada análise fica guardada (bp_documentos) para comparar no tempo.
 */
import { cabecalhoModulo } from "../core/acoes.js";
import { documentos, respostas, salvarDocumento, store } from "../core/db.js";
import * as I from "../core/indicadores.js";
import { colunas, linha } from "../core/graficos.js";
import { relatorioTexto } from "../core/texto.js";
import { FriendlyError, groqStructured, isClaudeUnavailable, loadKeys, requestStructured } from "../core/toolskit.js";
import { h, icone, kpi, ocupado, selo, toast, encher } from "../core/ui.js";
import { favorabilidadeRecente, indicadoresTurnover } from "./turnover.js";

const PROJ = 6;

/** Tudo o que a Gestão calcula (síncrono, a partir do store + respostas). */
export function cenario(lista = [], fav = new Map()) {
  const hoje = I.hojeISO();
  const serie = I.serieMensal(store, 12);
  const meses = serie.map((m) => I.rotuloMes(m.mes));
  const futuros = I.proximosMeses(PROJ).map(I.rotuloMes);
  const t = indicadoresTurnover(fav);
  const ativos = store.colaboradores.filter((c) => c.status === "ativo");
  const media = (dim) => {
    const u = [...I.ultimasPorPessoa(store.avaliacoes, store.colaboradores, dim).values()].map((a) => Number(a.media));
    return u.length ? u.reduce((s, x) => s + x, 0) / u.length : null;
  };
  // eNPS por pesquisa com respostas (ordem cronológica).
  const enpsPesquisas = store.pesquisas
    .filter((p) => p.tipo !== "offboarding")
    .map((p) => ({ p, r: I.resultadoPesquisa(p, lista.filter((x) => x.pesquisa_id === p.id)) }))
    .filter(({ r }) => r.total && r.enps != null)
    .sort((a, b) => a.p.criado_em.localeCompare(b.p.criado_em));
  const ultimoPulso = enpsPesquisas.at(-1);

  // Projeções.
  // Saídas esperadas por mês (risco) e headcount resultante mantendo o ritmo de admissões.
  const admMedia = serie.slice(-6).reduce((s, m) => s + m.admissoes, 0) / 6;
  const saidasProj = Array.from({ length: PROJ }, (_, k) => I.saidasEsperadas(t.riscos, t.taxaMensal, k + 1) - (k ? I.saidasEsperadas(t.riscos, t.taxaMensal, k) : 0));
  let hc = ativos.length;
  const hcRisco = saidasProj.map((s) => (hc = Math.max(0, hc + admMedia - s)));
  const prodProj = I.projetar(serie.map((m) => m.produtividade), PROJ, { min: 1, max: 5 });
  const cultProj = I.projetar(serie.map((m) => m.cultura), PROJ, { min: 1, max: 5 });
  const turnoverProj12 = ativos.length ? (I.saidasEsperadas(t.riscos, t.taxaMensal, 12) / ativos.length) * 100 : null;

  const ha90 = I.somarDias(hoje, -90);
  return {
    serie,
    meses,
    futuros,
    t,
    agora: {
      headcount: ativos.length,
      admissoes90: store.colaboradores.filter((c) => c.admissao && c.admissao >= ha90 && c.admissao <= hoje).length,
      saidas90: store.desligamentos.filter((d) => d.data >= ha90).length,
      produtividade: media("produtividade"),
      cultura: media("cultura"),
      enps: ultimoPulso?.r.enps ?? null,
      favorabilidade: ultimoPulso?.r.favorabilidade ?? null,
      pulso: ultimoPulso?.p.titulo ?? null,
      onbAndamento: store.onboardings.filter((o) => o.status === "em_andamento").length,
      onbAtrasados: store.onboardings.filter((o) => I.onboardingAtrasado(o)).length,
      riscoAlto: t.riscos.filter((r) => r.nivel === "alto").length,
      riscoMedio: t.riscos.filter((r) => r.nivel === "medio").length,
    },
    enpsPesquisas,
    proj: { hcRisco, saidasProj, prodProj, cultProj, turnoverProj12, admMedia },
  };
}

export function relatorioGestao(x, analise = null) {
  const a = x.agora;
  const r2 = I.regressao(x.serie.map((m) => m.headcount))?.r2;
  return {
    modulo: "gestao",
    titulo: "Gestão de pessoas — cenário, histórico e projeção",
    subtitulo: `Situação em ${I.fmtData(I.hojeISO())} · histórico de 12 meses · projeção de ${PROJ} meses`,
    kpis: [
      { rotulo: "Headcount", valor: String(a.headcount), detalhe: `+${a.admissoes90} / −${a.saidas90} em 90 dias` },
      { rotulo: "Turnover 12 meses", valor: I.pct(x.t.geral.taxa, 1), detalhe: `voluntário ${I.pct(x.t.vol.taxa, 1)}` },
      { rotulo: "Produtividade", valor: I.umaCasa(a.produtividade), detalhe: I.semaforo(a.produtividade).nome },
      { rotulo: "Cultura", valor: I.umaCasa(a.cultura), detalhe: I.semaforo(a.cultura).nome },
      { rotulo: "eNPS (último Pulso)", valor: a.enps == null ? "—" : String(a.enps), detalhe: a.pulso },
      { rotulo: "Risco de saída alto", valor: String(a.riscoAlto), detalhe: `${a.riscoMedio} em risco médio` },
      { rotulo: "Onboardings", valor: String(a.onbAndamento), detalhe: `${a.onbAtrasados} com fase atrasada` },
      { rotulo: `Saídas esperadas em ${PROJ} meses`, valor: I.umaCasa(x.proj.saidasProj.reduce((s, v) => s + v, 0)), detalhe: "projeção indicativa" },
      { rotulo: "Turnover projetado (12 meses)", valor: I.pct(x.proj.turnoverProj12, 1), detalhe: "pelo risco atual" },
    ],
    destaques: [
      `Headcount projetado em ${x.futuros.at(-1)}: ${Math.round(x.proj.hcRisco.at(-1))} (mantendo ${I.umaCasa(x.proj.admMedia)} admissões/mês e as saídas esperadas pelo risco).`,
      x.proj.prodProj ? `Produtividade tende a ${I.umaCasa(x.proj.prodProj.at(-1))} em ${x.futuros.at(-1)}.` : null,
      x.proj.cultProj ? `Cultura tende a ${I.umaCasa(x.proj.cultProj.at(-1))} em ${x.futuros.at(-1)}.` : null,
      r2 != null ? `Confiabilidade da tendência de headcount (R²): ${I.umaCasa(r2 * 100)}%.` : null,
      "Projeções são indicativas: tendência dos últimos 12 meses ajustada pelo risco de saída de cada pessoa.",
    ].filter(Boolean),
    graficos: [
      { titulo: "Headcount (12 meses + projeção)", tipo: "linha", casas: 0, itens: [...x.serie.map((m, i) => ({ rotulo: x.meses[i], valor: m.headcount })), ...x.proj.hcRisco.map((v, i) => ({ rotulo: x.futuros[i], valor: v, projetado: true }))] },
      { titulo: "Saídas por mês (12 meses + esperadas)", tipo: "colunas", casas: 1, itens: [...x.serie.map((m, i) => ({ rotulo: x.meses[i], valor: m.saidas })), ...x.proj.saidasProj.map((v, i) => ({ rotulo: x.futuros[i], valor: v, projetado: true }))] },
      { titulo: "Produtividade média (e tendência)", tipo: "linha", max: 5, itens: [...x.serie.map((m, i) => ({ rotulo: x.meses[i], valor: m.produtividade })), ...(x.proj.prodProj ?? []).map((v, i) => ({ rotulo: x.futuros[i], valor: v, projetado: true }))] },
      { titulo: "Cultura média (e tendência)", tipo: "linha", max: 5, itens: [...x.serie.map((m, i) => ({ rotulo: x.meses[i], valor: m.cultura })), ...(x.proj.cultProj ?? []).map((v, i) => ({ rotulo: x.futuros[i], valor: v, projetado: true }))] },
      { titulo: "eNPS por pesquisa", tipo: "colunas", casas: 0, itens: x.enpsPesquisas.map(({ p, r }) => ({ rotulo: I.fmtData(p.criado_em).slice(3), valor: r.enps })) },
    ],
    tabelas: [{ titulo: "Série mensal", colunas: ["Mês", "Headcount", "Admissões", "Saídas", "Turnover", "Produtividade", "Cultura"], linhas: x.serie.map((m, i) => [x.meses[i], String(m.headcount), String(m.admissoes), String(m.saidas), I.pct(m.turnover, 1), I.umaCasa(m.produtividade), I.umaCasa(m.cultura)]) }],
    textos: analise
      ? [
          { titulo: "Análise preditiva (IA) — resumo", texto: analise.resumo },
          { titulo: "Cenário atual", texto: analise.cenarioAtual },
          { titulo: "O que o histórico mostra", texto: analise.historico },
          { titulo: "Projeção", texto: analise.projecao },
          { titulo: "Riscos", texto: analise.riscos.map((r) => `• ${r}`).join("\n") },
          { titulo: "Recomendações", texto: analise.recomendacoes.map((r) => `• ${r.acao} (${r.prazo}; impacto ${r.impacto})`).join("\n") },
        ]
      : [],
  };
}

const SCHEMA_ANALISE = {
  type: "object",
  additionalProperties: false,
  required: ["resumo", "cenarioAtual", "historico", "projecao", "riscos", "oportunidades", "recomendacoes", "confianca"],
  properties: {
    resumo: { type: "string", description: "3 a 4 frases para a diretoria." },
    cenarioAtual: { type: "string" },
    historico: { type: "string" },
    projecao: { type: "string", description: "O que deve acontecer nos próximos 6 meses se nada mudar, com os números da projeção." },
    riscos: { type: "array", items: { type: "string" } },
    oportunidades: { type: "array", items: { type: "string" } },
    recomendacoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["acao", "prazo", "impacto"],
        properties: { acao: { type: "string" }, prazo: { type: "string", enum: ["30 dias", "60 dias", "90 dias", "6 meses"] }, impacto: { type: "string", enum: ["alto", "médio", "baixo"] } },
      },
    },
    confianca: { type: "string", enum: ["alta", "média", "baixa"], description: "Confiança da leitura, pelo volume e pela qualidade dos dados." },
  },
};

const SISTEMA_ANALISE = `Você é consultor(a) sênior de People Analytics de uma consultoria de alto nível. Lê indicadores de pessoas de uma empresa (quadro, turnover, produtividade, cultura, clima/eNPS, onboarding, risco de saída) e escreve uma análise executiva com leitura do presente, do passado e uma projeção para os próximos 6 meses.

REGRAS
- Use somente os números do relatório. Não invente benchmarks, valores ou causas sem evidência; quando inferir, diga que é hipótese.
- Projeções e riscos são indicativos (tendência + risco). Diga o que muda o cenário.
- Recomendações concretas, priorizadas e com prazo, ligadas aos dados (ex.: conversas de permanência com quem está em risco alto, plano para o critério mais fraco, cadência de avaliação).
- Nunca recomende decisões sobre uma pessoa com base no risco (ele serve para priorizar conversas). Respeite a LGPD: não exponha nomes.
- Se houver poucos dados, diga isso e indique confiança baixa.
- Português do Brasil, tom consultivo, frases curtas.`;

async function analisar(rel) {
  const keys = await loadKeys();
  const user = `Data de hoje: ${I.fmtData(I.hojeISO())}\n\n${relatorioTexto({ ...rel, tabelas: rel.tabelas, textos: [] })}`;
  if (keys.apiKey) {
    try {
      const { toStructuredSchema } = await import("../../../extensao-entrevistas/src/schema.js");
      return { ...(await requestStructured({ apiKey: keys.apiKey, system: SISTEMA_ANALISE, content: [{ type: "text", text: user }], format: { type: "json_schema", schema: toStructuredSchema(SCHEMA_ANALISE) }, effort: "high" })), origem: "Claude" };
    } catch (e) {
      if (!keys.groqKey || !isClaudeUnavailable(e)) throw e;
    }
  }
  if (keys.groqKey) return { ...(await groqStructured({ apiKey: keys.groqKey, system: SISTEMA_ANALISE, user, name: "analise_gestao", schema: SCHEMA_ANALISE, reasoningEffort: "medium" })), origem: "Groq" };
  throw new FriendlyError("Cadastre uma chave da Anthropic ou da Groq em Configurações.");
}

function cartaoAnalise(doc) {
  const a = doc.conteudo;
  const tom = { alto: "perigo", médio: "alerta", baixo: "neutro" };
  return h(
    "div",
    { class: "card analise" },
    h("div", { class: "fase__topo" }, h("h2", { text: "Análise preditiva" }), selo(`Confiança ${a.confianca}`, a.confianca === "alta" ? "sucesso" : a.confianca === "média" ? "alerta" : "neutro")),
    h("p", { class: "hint", text: `${I.fmtDataHora(doc.criado_em)} · ${a.origem ?? "IA"}` }),
    h("p", { class: "analise__resumo", text: a.resumo }),
    [["Agora", a.cenarioAtual], ["Histórico", a.historico], ["Próximos 6 meses", a.projecao]].map(([t, x]) => h("div", { class: "analise__bloco" }, h("p", { class: "note__title", text: t }), h("p", { text: x }))),
    a.riscos?.length ? h("div", { class: "analise__bloco" }, h("p", { class: "note__title", text: "Riscos" }), h("ul", { class: "list" }, a.riscos.map((r) => h("li", { text: r })))) : null,
    a.oportunidades?.length ? h("div", { class: "analise__bloco" }, h("p", { class: "note__title", text: "Oportunidades" }), h("ul", { class: "list" }, a.oportunidades.map((r) => h("li", { text: r })))) : null,
    h("div", { class: "analise__bloco" }, h("p", { class: "note__title", text: "Recomendações" }), h("ul", { class: "recomendacoes" }, a.recomendacoes.map((r) => h("li", {}, h("span", { text: r.acao }), h("span", { class: "recomendacoes__meta" }, selo(r.prazo, "info"), selo(`impacto ${r.impacto}`, tom[r.impacto])))))),
  );
}

export function criarGestao() {
  const raiz = h("section", { class: "modulo" });
  let analise = null;
  let ultimo = null;

  async function render() {
    const [lista, fav, docs] = await Promise.all([respostas().catch(() => []), favorabilidadeRecente(), analise ? Promise.resolve(null) : documentos({ tipo: "analise", modulo: "gestao", limite: 1 }).catch(() => [])]);
    if (docs?.[0]) analise = docs[0];
    const x = cenario(lista, fav);
    ultimo = x;
    const rel = relatorioGestao(x, analise?.conteudo);
    const botaoIa = h("button", { type: "button", class: "btn btn--primary" }, icone("ia"), analise ? "Atualizar análise preditiva com IA" : "Gerar análise preditiva com IA");
    const statusIa = h("p", { class: "hint", role: "status" });
    botaoIa.addEventListener("click", () =>
      ocupado(botaoIa, "Analisando os dados…", async () => {
        statusIa.textContent = "A IA está lendo o cenário, o histórico e a projeção (20 a 60 s).";
        try {
          const conteudo = await analisar(relatorioGestao(ultimo));
          analise = await salvarDocumento({ tipo: "analise", modulo: "gestao", titulo: `Análise preditiva · ${I.fmtData(I.hojeISO())}`, conteudo });
          toast("Análise gerada e guardada no histórico.");
          render();
        } catch (e) {
          console.error(e);
          statusIa.textContent = e instanceof FriendlyError ? e.message : "Não foi possível gerar a análise agora.";
        }
      }),
    );
    const g = rel.graficos;
    const serieLinha = (gr) => ({ valores: gr.itens.filter((i) => !i.projetado).map((i) => i.valor), projecao: gr.itens.filter((i) => i.projetado).map((i) => i.valor) });
    const prod = serieLinha(g[2]);
    const cult = serieLinha(g[3]);
    const hc = serieLinha(g[0]);
    encher(raiz, 
      cabecalhoModulo({ eyebrow: "Gestão", titulo: "Gestão de pessoas", lead: "O que está acontecendo agora, o que aconteceu nos últimos 12 meses e para onde os indicadores apontam.", montar: () => relatorioGestao(ultimo, analise?.conteudo) }),
      h("h2", { class: "secao", text: "Agora" }),
      h("div", { class: "kpis" }, rel.kpis.slice(0, 7).map((k, i) => kpi(k.rotulo, k.valor, k.detalhe, i === 5 && k.valor !== "0" ? "perigo" : null))),
      h("h2", { class: "secao", text: "Histórico e projeção" }),
      h("div", { class: "card" }, h("h2", { text: "Headcount" }), linha([{ nome: "Headcount", valores: hc.valores, projecao: hc.projecao }], x.meses, { rotulosProjecao: x.futuros, casas: 0, rotulo: "Headcount com projeção" })),
      h("div", { class: "card" }, h("h2", { text: "Saídas por mês" }), colunas(g[1].itens.filter((i) => !i.projetado).map((i) => i.valor), x.meses, { projecao: g[1].itens.filter((i) => i.projetado).map((i) => i.valor), rotulosProjecao: x.futuros, casas: 0, nome: "Saídas", rotulo: "Saídas por mês com saídas esperadas" })),
      prod.valores.some((v) => v != null) || cult.valores.some((v) => v != null)
        ? h("div", { class: "card" }, h("h2", { text: "Produtividade e Cultura" }), linha([{ nome: "Produtividade", ...prod }, { nome: "Cultura", ...cult }], x.meses, { rotulosProjecao: x.futuros, min: 1, max: 5, rotulo: "Médias mensais de Produtividade e Cultura com tendência" }))
        : null,
      g[4].itens.length > 1 ? h("div", { class: "card" }, h("h2", { text: "eNPS por pesquisa" }), colunas(g[4].itens.map((i) => i.valor), g[4].itens.map((i) => i.rotulo), { casas: 0, nome: "eNPS", rotulo: "eNPS por pesquisa" })) : null,
      h("h2", { class: "secao", text: "Projeção" }),
      h("div", { class: "kpis kpis--3" }, rel.kpis.slice(7).map((k) => kpi(k.rotulo, k.valor, k.detalhe)), kpi(`Headcount em ${x.futuros.at(-1)}`, String(Math.round(x.proj.hcRisco.at(-1))), "projeção indicativa")),
      h("div", { class: "note" }, h("ul", { class: "list" }, rel.destaques.map((d) => h("li", { text: d })))),
      botaoIa,
      statusIa,
      analise ? cartaoAnalise(analise) : null,
    );
  }

  return { raiz, render };
}
