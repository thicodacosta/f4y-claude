/**
 * Pulso: 5 tipos de pesquisa (2 de 15 perguntas, 2 de 30 e 1 personalizada,
 * escrita pelo usuário). Cada pesquisa gera um link público
 * (public/responder.html); as respostas voltam para o banco pela função
 * bp_responder_pesquisa e aparecem aqui, agregadas.
 */
import { cabecalhoModulo, barraAcoes } from "../core/acoes.js";
import { urlPublica } from "../core/config.js";
import { atualizar, carregar, excluir, inserir, respostas, store } from "../core/db.js";
import * as I from "../core/indicadores.js";
import { barras, linha, medidor } from "../core/graficos.js";
import { MODELOS, TIPOS_PERGUNTA, TIPOS_PULSO, linkPublico, novaPergunta } from "../core/pesquisas.js";
import { FriendlyError, groqStructured, isClaudeUnavailable, loadKeys, requestStructured } from "../core/toolskit.js";
import { campo, confirmar, h, icone, kpi, modal, ocupado, select, selo, toast, vazio } from "../core/ui.js";

const pulsos = () => store.pesquisas.filter((p) => p.tipo !== "offboarding");
const aberta = (p) => p.status === "aberta" && (!p.encerra_em || p.encerra_em >= I.hojeISO());

export function relatorioPesquisa(p, lista) {
  const r = I.resultadoPesquisa(p, lista);
  const porArea = I.favorabilidadePorArea(p, lista);
  return {
    modulo: "pulso",
    titulo: p.titulo,
    subtitulo: `${MODELOS[p.tipo]?.nome ?? "Pesquisa"} · ${r.total} resposta(s) · ${p.anonima ? "anônima" : "identificada"} · criada em ${I.fmtData(p.criado_em)}`,
    kpis: [
      { rotulo: "Respostas", valor: String(r.total) },
      { rotulo: "Favorabilidade", valor: I.pct(r.favorabilidade), detalhe: "% de respostas 4 e 5" },
      { rotulo: "eNPS", valor: r.enps == null ? "—" : String(r.enps), detalhe: "% promotores − % detratores" },
    ],
    destaques: [
      r.dimensoes[0] ? `Ponto mais forte: ${r.dimensoes[0].nome} (${I.pct(r.dimensoes[0].favorabilidade)} favorável).` : null,
      r.dimensoes.length > 1 ? `Ponto de atenção: ${r.dimensoes.at(-1).nome} (${I.pct(r.dimensoes.at(-1).favorabilidade)} favorável).` : null,
      ...r.porPergunta.filter((q) => q.favorabilidade != null).sort((a, b) => a.favorabilidade - b.favorabilidade).slice(0, 2).map((q) => `Menor favorabilidade: "${q.pergunta.texto}" (${I.pct(q.favorabilidade)}).`),
    ].filter(Boolean),
    graficos: [
      { titulo: "Favorabilidade por dimensão", tipo: "barras", max: 100, sufixo: "%", casas: 0, itens: r.dimensoes.map((d) => ({ rotulo: d.nome, valor: d.favorabilidade })) },
      porArea.size ? { titulo: `Favorabilidade por área (mín. ${I.MINIMO_RECORTE} respostas)`, tipo: "barras", max: 100, sufixo: "%", casas: 0, itens: [...porArea].map(([rotulo, valor]) => ({ rotulo, valor })) } : null,
    ].filter(Boolean),
    tabelas: [
      {
        titulo: "Resultado por pergunta",
        colunas: ["Pergunta", "Respostas", "Resultado"],
        linhas: r.porPergunta.map((q) => [
          q.pergunta.texto,
          String(q.total),
          q.pergunta.tipo === "nps" ? `eNPS ${q.enps ?? "—"} · média ${I.umaCasa(q.media)}` : q.contagem ? q.contagem.map((o) => `${o.rotulo}: ${o.n}`).join(" · ") : q.textos ? `${q.textos.length} comentário(s)` : `${I.pct(q.favorabilidade)} favorável · média ${I.umaCasa(q.media)}`,
        ]),
      },
    ],
    textos: [{ titulo: "Comentários", texto: r.comentarios.slice(0, 30).map((c) => `• ${c.texto}`).join("\n") }],
  };
}

export function relatorioPulso() {
  const lista = pulsos();
  return {
    modulo: "pulso",
    titulo: "Pulso — pesquisas",
    subtitulo: `${lista.length} pesquisa(s) · ${lista.filter(aberta).length} aberta(s)`,
    kpis: [
      { rotulo: "Pesquisas", valor: String(lista.length) },
      { rotulo: "Abertas", valor: String(lista.filter(aberta).length) },
      { rotulo: "Respostas recebidas", valor: String(lista.reduce((s, p) => s + p.total_respostas, 0)) },
    ],
    tabelas: [{ titulo: "Pesquisas", colunas: ["Pesquisa", "Tipo", "Criada em", "Respostas", "Situação"], linhas: lista.map((p) => [p.titulo, MODELOS[p.tipo]?.nome ?? p.tipo, I.fmtData(p.criado_em), String(p.total_respostas), aberta(p) ? "Aberta" : "Encerrada"]) }],
  };
}

// ─── Criação ───────────────────────────────────────────────────────────────

const SCHEMA_PERGUNTAS = {
  type: "object",
  additionalProperties: false,
  required: ["perguntas"],
  properties: {
    perguntas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "texto", "dimensao", "opcoes"],
        properties: {
          tipo: { type: "string", enum: Object.keys(TIPOS_PERGUNTA) },
          texto: { type: "string" },
          dimensao: { type: "string" },
          opcoes: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

async function sugerirPerguntas(tema, quantidade) {
  const keys = await loadKeys();
  const system = "Você é especialista em pesquisas de clima e experiência do colaborador. Escreva perguntas claras, neutras (sem induzir resposta), em português do Brasil, adequadas a uma consultoria de RH sofisticada. Prefira 'likert' para afirmações, use 'nps' no máximo uma vez, 'escolha'/'multipla' com 3 a 7 opções curtas (opcoes vazio nos demais tipos) e termine com uma pergunta 'texto' aberta. Agrupe por 'dimensao' (tema curto).";
  const user = `Tema e objetivo da pesquisa: ${tema}\nQuantidade de perguntas: ${quantidade}`;
  let r;
  if (keys.apiKey) {
    try {
      const { toStructuredSchema } = await import("../../../extensao-entrevistas/src/schema.js");
      r = await requestStructured({ apiKey: keys.apiKey, system, content: [{ type: "text", text: user }], format: { type: "json_schema", schema: toStructuredSchema(SCHEMA_PERGUNTAS) }, effort: "low" });
    } catch (e) {
      if (!keys.groqKey || !isClaudeUnavailable(e)) throw e;
    }
  }
  if (!r && keys.groqKey) r = await groqStructured({ apiKey: keys.groqKey, system, user, name: "perguntas", schema: SCHEMA_PERGUNTAS, reasoningEffort: "low" });
  if (!r) throw new FriendlyError("Cadastre uma chave da Anthropic ou da Groq em Configurações.");
  return r.perguntas.slice(0, 40).map((q) => {
    const p = novaPergunta(q.tipo);
    p.texto = q.texto;
    p.dimensao = q.dimensao || "Geral";
    if (p.opcoes && q.opcoes.length) p.opcoes = q.opcoes.slice(0, 10).map((rotulo, i) => ({ id: `o${i + 1}`, rotulo }));
    return p;
  });
}

/** Editor de perguntas (pesquisa personalizada). */
function editorPerguntas(perguntas) {
  const caixa = h("div", { class: "editor" });
  const desenhar = () => {
    caixa.replaceChildren(
      ...perguntas.map((p, i) => {
        const opcoes =
          p.opcoes &&
          h(
            "div",
            { class: "editor__opcoes" },
            p.opcoes.map((o, k) =>
              h(
                "div",
                { class: "editor__opcao" },
                h("input", { value: o.rotulo, "aria-label": `Opção ${k + 1}`, oninput: (e) => (o.rotulo = e.target.value) }),
                h("button", { type: "button", class: "btn-link", "aria-label": "Remover opção", onclick: () => { p.opcoes.splice(k, 1); desenhar(); } }, "×"),
              ),
            ),
            p.opcoes.length < 10 ? h("button", { type: "button", class: "btn-link", onclick: () => { p.opcoes.push({ id: `o${Date.now().toString(36)}`, rotulo: `Opção ${p.opcoes.length + 1}` }); desenhar(); } }, "+ Opção") : null,
          );
        return h(
          "div",
          { class: "editor__pergunta" },
          h(
            "div",
            { class: "editor__topo" },
            h("span", { class: "editor__num", text: String(i + 1) }),
            select(Object.entries(TIPOS_PERGUNTA), p.tipo, {
              "aria-label": "Tipo de resposta",
              onchange: (e) => {
                const nova = novaPergunta(e.target.value);
                perguntas[i] = { ...nova, id: p.id, texto: p.texto, dimensao: p.dimensao };
                desenhar();
              },
            }),
            h("button", { type: "button", class: "btn-link", disabled: i === 0, "aria-label": "Subir", onclick: () => { [perguntas[i - 1], perguntas[i]] = [perguntas[i], perguntas[i - 1]]; desenhar(); } }, "↑"),
            h("button", { type: "button", class: "btn-link", disabled: i === perguntas.length - 1, "aria-label": "Descer", onclick: () => { [perguntas[i + 1], perguntas[i]] = [perguntas[i], perguntas[i + 1]]; desenhar(); } }, "↓"),
            h("button", { type: "button", class: "btn-link btn--danger", "aria-label": "Remover pergunta", onclick: () => { perguntas.splice(i, 1); desenhar(); } }, "Remover"),
          ),
          h("textarea", { rows: 2, placeholder: "Escreva a pergunta", value: p.texto, "aria-label": `Pergunta ${i + 1}`, oninput: (e) => (p.texto = e.target.value) }),
          h(
            "div",
            { class: "editor__linha" },
            h("input", { value: p.dimensao, placeholder: "Tema (ex.: Liderança)", "aria-label": "Tema da pergunta", oninput: (e) => (p.dimensao = e.target.value) }),
            h("label", { class: "consent" }, h("input", { type: "checkbox", checked: p.obrigatoria, onchange: (e) => (p.obrigatoria = e.target.checked) }), h("span", { text: "Obrigatória" })),
          ),
          p.tipo === "escala" ? h("div", { class: "editor__linha" }, h("input", { value: p.minimo ?? "", placeholder: "Rótulo do 1", oninput: (e) => (p.minimo = e.target.value) }), h("input", { value: p.maximo ?? "", placeholder: "Rótulo do 5", oninput: (e) => (p.maximo = e.target.value) })) : null,
          opcoes,
        );
      }),
      h(
        "div",
        { class: "actions" },
        perguntas.length < 40 ? h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => { perguntas.push(novaPergunta("likert")); desenhar(); caixa.querySelector(".editor__pergunta:last-of-type textarea")?.focus(); } }, icone("mais"), "Adicionar pergunta") : null,
      ),
    );
  };
  desenhar();
  return { caixa, desenhar };
}

async function novaPesquisa() {
  // 1) Tipo.
  const tipo = await modal(
    "Nova pesquisa",
    (fechar) =>
      h(
        "div",
        { class: "tipos" },
        h("p", { class: "hint", text: "Escolha o tipo. Os modelos já trazem perguntas validadas; na personalizada, você escreve tudo." }),
        TIPOS_PULSO.map((t) =>
          h(
            "button",
            { type: "button", class: "tipo", onclick: () => fechar(t) },
            h("strong", { text: MODELOS[t].nome }),
            MODELOS[t].tamanho ? selo(`${MODELOS[t].tamanho} perguntas`, "info") : selo("Você escreve", "neutro"),
            h("span", { class: "hint", text: MODELOS[t].resumo }),
          ),
        ),
      ),
    { largo: true },
  );
  if (!tipo) return null;

  // 2) Detalhes e perguntas.
  return modal(
    MODELOS[tipo].nome,
    (fechar) => {
      const modelo = MODELOS[tipo];
      const perguntas = structuredClone(modelo.perguntas.length ? modelo.perguntas : [novaPergunta("likert"), novaPergunta("nps"), novaPergunta("texto")]);
      const titulo = h("input", { value: `${modelo.nome === "Personalizada" ? "" : `${modelo.nome} · `}${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`, required: true });
      const descricao = h("textarea", { rows: 2, value: modelo.descricao, placeholder: "Mensagem de abertura para quem vai responder" });
      const anonima = h("input", { type: "checkbox", checked: true });
      const encerra = h("input", { type: "date", min: I.hojeISO(), value: I.somarDias(I.hojeISO(), 14) });
      const erro = h("p", { class: "error", hidden: true });
      const editor = tipo === "personalizada" ? editorPerguntas(perguntas) : null;
      const tema = h("input", { placeholder: "Ex.: retorno ao escritório 3x por semana" });
      const qtd = h("input", { type: "number", min: "3", max: "40", value: "10", style: { maxWidth: "90px" } });
      const sugerir = h("button", { type: "button", class: "btn btn--ghost btn--sm" }, icone("ia"), "Sugerir perguntas com IA");
      sugerir.addEventListener("click", () =>
        ocupado(sugerir, "Escrevendo…", async () => {
          if (!tema.value.trim()) return Object.assign(erro, { textContent: "Descreva o tema para a IA sugerir.", hidden: false });
          try {
            const novas = await sugerirPerguntas(tema.value.trim(), Math.min(40, Math.max(3, Number(qtd.value) || 10)));
            perguntas.splice(0, perguntas.length, ...novas);
            editor.desenhar();
            erro.hidden = true;
          } catch (e) {
            Object.assign(erro, { textContent: e instanceof FriendlyError ? e.message : "A IA não respondeu agora.", hidden: false });
          }
        }),
      );
      return h(
        "form",
        {
          novalidate: true,
          onsubmit: async (e) => {
            e.preventDefault();
            const validas = perguntas.filter((p) => p.texto.trim());
            if (!titulo.value.trim()) return Object.assign(erro, { textContent: "Dê um título à pesquisa.", hidden: false });
            if (!validas.length) return Object.assign(erro, { textContent: "Escreva ao menos uma pergunta.", hidden: false });
            if (validas.some((p) => p.opcoes && p.opcoes.filter((o) => o.rotulo.trim()).length < 2)) return Object.assign(erro, { textContent: "Perguntas de escolha precisam de ao menos 2 opções.", hidden: false });
            try {
              const p = await inserir(
                "bp_pesquisas",
                {
                  tipo,
                  titulo: titulo.value.trim(),
                  descricao: descricao.value.trim() || null,
                  perguntas: validas.map((q) => ({ ...q, texto: q.texto.trim(), opcoes: q.opcoes?.filter((o) => o.rotulo.trim()) })),
                  anonima: anonima.checked,
                  encerra_em: encerra.value || null,
                },
                "criar a pesquisa",
              );
              fechar(p);
            } catch (err) {
              Object.assign(erro, { textContent: err.message, hidden: false });
            }
          },
        },
        campo("Título", titulo),
        campo("Mensagem de abertura", descricao),
        h("div", { class: "field-grid" }, campo("Encerra em", encerra, "Depois dessa data o link para de aceitar respostas."), h("label", { class: "consent consent--campo" }, anonima, h("span", { text: "Anônima (não pede nome nem e-mail)" }))),
        editor
          ? [h("div", { class: "card card--suave" }, h("p", { class: "note__title", text: "Escreva suas perguntas" }), h("div", { class: "editor__ia" }, tema, qtd, sugerir)), editor.caixa]
          : h("details", { class: "card" }, h("summary", { text: `Ver as ${perguntas.length} perguntas` }), h("ol", { class: "list" }, perguntas.map((q) => h("li", {}, q.texto, h("span", { class: "hint", text: ` · ${TIPOS_PERGUNTA[q.tipo]} · ${q.dimensao}` }))))),
        erro,
        h("button", { type: "submit", class: "btn btn--primary" }, "Criar pesquisa e gerar link"),
      );
    },
    { largo: true },
  );
}

// ─── Tela ──────────────────────────────────────────────────────────────────

export function criarPulso() {
  const raiz = h("section", { class: "modulo" });
  let aberta_ = null;

  async function painelLink(p) {
    const base = await urlPublica();
    const link = linkPublico(base, p.token);
    if (!link) {
      return h("div", { class: "banner" }, "Configure o endereço da página pública em ", h("a", { href: "options.html", target: "_blank", text: "Configurações" }), " para gerar o link desta pesquisa.");
    }
    const entrada = h("input", { value: link, readonly: true, "aria-label": "Link público da pesquisa", onfocus: (e) => e.target.select() });
    return h(
      "div",
      { class: "card link-publico" },
      h("p", { class: "note__title", text: "Link público para responder" }),
      entrada,
      h(
        "div",
        { class: "actions" },
        h("button", { type: "button", class: "btn btn--primary btn--auto", onclick: async () => { await navigator.clipboard.writeText(link); toast("Link copiado."); } }, icone("link"), "Copiar link"),
        h("a", { class: "btn btn--ghost", href: link, target: "_blank", rel: "noopener" }, "Abrir"),
      ),
      h("p", { class: "hint", text: "Envie por e-mail, WhatsApp ou Teams. As respostas chegam aqui automaticamente." }),
    );
  }

  async function detalhe(p) {
    const lista = (await respostas()).filter((r) => r.pesquisa_id === p.id);
    const r = I.resultadoPesquisa(p, lista);
    const rel = relatorioPesquisa(p, lista);
    const porDia = new Map();
    for (const x of lista) porDia.set(x.criado_em.slice(0, 10), (porDia.get(x.criado_em.slice(0, 10)) ?? 0) + 1);
    const dias = [...porDia.keys()].sort();
    let acumulado = 0;
    return h(
      "div",
      {},
      h("button", { type: "button", class: "btn-link voltar", onclick: () => { aberta_ = null; render(); } }, "← Pesquisas"),
      h("header", { class: "modulo__topo" }, h("p", { class: "eyebrow", text: MODELOS[p.tipo]?.nome ?? "Pesquisa" }), h("h1", { class: "title", text: p.titulo }), h("p", { class: "lead" }, aberta(p) ? selo("Aberta", "sucesso") : selo("Encerrada", "neutro"), ` ${p.perguntas.length} perguntas · ${p.anonima ? "anônima" : "identificada"}${p.encerra_em ? ` · encerra em ${I.fmtData(p.encerra_em)}` : ""}`), barraAcoes(() => relatorioPesquisa(p, lista))),
      aberta(p) ? await painelLink(p) : null,
      h(
        "div",
        { class: "actions" },
        h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: async (e) => { await ocupado(e.currentTarget, "Atualizando…", carregar); render(); } }, "Atualizar respostas"),
        h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: async () => { await atualizar("bp_pesquisas", p.id, aberta(p) ? { status: "encerrada" } : { status: "aberta", encerra_em: p.encerra_em && p.encerra_em < I.hojeISO() ? null : p.encerra_em }, "alterar a pesquisa"); render(); } }, aberta(p) ? "Encerrar" : "Reabrir"),
        h("button", { type: "button", class: "btn btn--ghost btn--sm btn--danger", onclick: async () => { if (await confirmar(`Excluir "${p.titulo}" e as ${lista.length} respostas? Não dá para desfazer.`, "Excluir")) { await excluir("bp_pesquisas", p.id, "excluir a pesquisa"); aberta_ = null; render(); } } }, "Excluir"),
      ),
      r.total
        ? [
            h("div", { class: "kpis kpis--3" }, rel.kpis.map((k) => kpi(k.rotulo, k.valor, k.detalhe))),
            h("div", { class: "medidores" }, h("div", { class: "card" }, h("h2", { text: "Favorabilidade" }), medidor(r.favorabilidade, { sufixo: "%", rotulo: "Favorabilidade" })), r.enps != null ? h("div", { class: "card" }, h("h2", { text: "eNPS" }), medidor(r.enps, { min: -100, max: 100, rotulo: "eNPS" })) : null),
            dias.length > 1 ? h("div", { class: "card" }, h("h2", { text: "Respostas acumuladas" }), linha([{ nome: "Respostas", valores: dias.map((d) => (acumulado += porDia.get(d))) }], dias.map((d) => I.fmtData(d).slice(0, 5)), { casas: 0, rotulo: "Respostas acumuladas por dia" })) : null,
            r.dimensoes.length ? h("div", { class: "card" }, h("h2", { text: "Por dimensão" }), barras(r.dimensoes.map((d) => ({ rotulo: d.nome, valor: d.favorabilidade, tom: d.favorabilidade < 50 ? "perigo" : null })), { max: 100, sufixo: "%", casas: 0, rotulo: "Favorabilidade por dimensão" })) : null,
            rel.graficos[1] ? h("div", { class: "card" }, h("h2", { text: rel.graficos[1].titulo }), barras(rel.graficos[1].itens, { max: 100, sufixo: "%", casas: 0, rotulo: "Favorabilidade por área" })) : null,
            h(
              "div",
              { class: "card" },
              h("h2", { text: "Por pergunta" }),
              h(
                "ol",
                { class: "perguntas-resultado" },
                r.porPergunta.map((q) =>
                  h(
                    "li",
                    {},
                    h("p", { class: "item__title", text: q.pergunta.texto }),
                    q.pergunta.tipo === "nps"
                      ? h("p", { class: "hint", text: `eNPS ${q.enps ?? "—"} · nota média ${I.umaCasa(q.media)} · ${q.total} resposta(s)` })
                      : q.contagem
                        ? barras(q.contagem.map((o) => ({ rotulo: o.rotulo, valor: q.total ? (o.n / q.total) * 100 : 0, detalhe: `${o.n} resposta(s)` })), { max: 100, sufixo: "%", casas: 0, rotulo: q.pergunta.texto })
                        : q.textos
                          ? h("ul", { class: "comentarios" }, q.textos.length ? q.textos.slice(0, 30).map((t) => h("li", { text: t })) : h("li", { class: "hint", text: "Sem comentários." }))
                          : h("div", {}, h("div", { class: "distribuicao", role: "img", "aria-label": `Distribuição de 1 a 5: ${q.distribuicao.join(", ")}` }, q.distribuicao.map((n, k) => (n ? h("span", { class: `distribuicao__seg distribuicao__seg--${k + 1}`, style: { flexGrow: String(n) }, title: `Nota ${k + 1}: ${n} resposta(s)` }, `${k + 1}·${n}`) : null))), h("p", { class: "hint", text: `${I.pct(q.favorabilidade)} favorável (4 e 5) · média ${I.umaCasa(q.media)}` })),
                  ),
                ),
              ),
            ),
            !p.anonima && lista.some((x) => x.nome || x.email)
              ? h("details", { class: "card" }, h("summary", { text: "Quem respondeu" }), h("ul", { class: "list" }, lista.map((x) => h("li", { text: `${x.nome ?? "—"} · ${x.email ?? "sem e-mail"}${x.colaborador_id ? " · ligado ao cadastro" : ""} · ${I.fmtDataHora(x.criado_em)}` }))))
              : null,
          ]
        : vazio("Ainda sem respostas. Compartilhe o link e clique em \"Atualizar respostas\"."),
    );
  }

  function lista() {
    const ps = pulsos();
    const rel = relatorioPulso();
    return h(
      "div",
      {},
      cabecalhoModulo({ eyebrow: "Pulso", titulo: "Pesquisas de pulso", lead: "Engajamento (15), Bem-estar e eNPS (15), Clima (30), Liderança e Cultura (30) ou a sua própria pesquisa. Link público, respostas de volta aqui.", montar: relatorioPulso }),
      h("div", { class: "kpis kpis--3" }, rel.kpis.map((k) => kpi(k.rotulo, k.valor, k.detalhe))),
      h("button", { type: "button", class: "btn btn--primary", onclick: async () => { const p = await novaPesquisa(); if (p) { aberta_ = p.id; render(); toast("Pesquisa criada. Copie o link para enviar."); } } }, "Nova pesquisa"),
      ps.length
        ? h(
            "ul",
            { class: "lista" },
            ps.map((p) =>
              h("li", {}, h("button", { type: "button", class: "linha-item", onclick: () => { aberta_ = p.id; render(); } }, h("span", { class: "linha-item__principal" }, h("strong", { text: p.titulo }), h("span", { class: "hint", text: `${MODELOS[p.tipo]?.nome} · ${p.total_respostas} resposta(s) · ${I.fmtData(p.criado_em)}` })), aberta(p) ? selo("Aberta", "sucesso") : selo("Encerrada", "neutro"))),
            ),
          )
        : vazio("Nenhuma pesquisa ainda."),
    );
  }

  async function render() {
    const p = aberta_ && store.pesquisas.find((x) => x.id === aberta_);
    try {
      raiz.replaceChildren(p ? await detalhe(p) : lista());
    } catch (e) {
      console.error(e);
      raiz.replaceChildren(vazio(e.message ?? "Não foi possível carregar a pesquisa."));
    }
  }

  return { raiz, render, voltar: () => (aberta_ = null) };
}
