/**
 * Gráficos em SVG para o painel (estreito: ~360px). Marcas finas, um único
 * eixo, grade recessiva, rótulos em tinta de texto (nunca na cor da série),
 * dica ao passar o mouse (<title>) e legenda quando há 2 séries. Cores pelos
 * tokens --serie-1/--serie-2 (claro e escuro em styles.css). Projeções em
 * traço pontilhado, sempre rotuladas como "projeção".
 */
const NS = "http://www.w3.org/2000/svg";

function svg(tag, attrs = {}, ...filhos) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const f of filhos) if (f) n.append(f);
  return n;
}
const titulo = (texto) => svg("title", {}, document.createTextNode(texto));
const txt = (x, y, texto, attrs = {}) => svg("text", { x, y, class: "g-txt", ...attrs }, document.createTextNode(texto));
/** Rótulos do eixo x: a cada `passo`, sempre com o último; o penúltimo some se ficar colado nele. */
function rotulosVisiveis(total, passo) {
  const ultimo = total - 1;
  const anterior = Math.floor(ultimo / passo) * passo;
  return (i) => i === ultimo || (i % passo === 0 && !(i === anterior && ultimo - anterior < passo));
}
const fmt = (v, casas = 0) => (v == null ? "—" : Number(v).toFixed(casas).replace(".", ","));

function figura(svgNode, legenda, rotuloAcessivel) {
  const fig = document.createElement("figure");
  fig.className = "grafico";
  svgNode.setAttribute("role", "img");
  svgNode.setAttribute("aria-label", rotuloAcessivel);
  fig.append(svgNode);
  if (legenda) fig.append(legenda);
  return fig;
}

/**
 * Barras horizontais: [{ rotulo, valor, detalhe? }]. Valor ao fim da barra.
 * `max` fixa a escala (ex.: 5 para médias, 100 para %).
 */
export function barras(itens, { max, casas = 1, sufixo = "", rotulo = "Gráfico de barras" } = {}) {
  const largura = 360;
  const linha = 30;
  const esquerda = 132;
  const direita = 44;
  const altura = itens.length * linha + 4;
  const escala = max ?? Math.max(1, ...itens.map((i) => i.valor ?? 0));
  const area = largura - esquerda - direita;
  const g = svg("svg", { viewBox: `0 0 ${largura} ${altura}`, class: "g" });
  itens.forEach((it, i) => {
    const y = i * linha + 4;
    const w = it.valor == null ? 0 : Math.max(2, (it.valor / escala) * area);
    const nome = it.rotulo.length > 22 ? `${it.rotulo.slice(0, 21)}…` : it.rotulo;
    const grupo = svg("g", { class: "g-alvo" }, titulo(`${it.rotulo}: ${fmt(it.valor, casas)}${sufixo}${it.detalhe ? ` · ${it.detalhe}` : ""}`));
    grupo.append(
      svg("rect", { x: 0, y: y - 2, width: largura, height: linha - 2, class: "g-hit" }),
      txt(esquerda - 8, y + 15, nome, { "text-anchor": "end", class: "g-txt g-rot" }),
      svg("rect", { x: esquerda, y: y + 6, width: area, height: 12, rx: 4, class: "g-trilho" }),
      svg("rect", { x: esquerda, y: y + 6, width: w, height: 12, rx: 4, class: `g-barra${it.tom ? ` g-barra--${it.tom}` : ""}` }),
      txt(esquerda + area + 6, y + 15, it.valor == null ? "—" : `${fmt(it.valor, casas)}${sufixo}`, { class: "g-txt g-val" }),
    );
    g.append(grupo);
  });
  return figura(g, null, rotulo);
}

/**
 * Linha mensal com projeção opcional.
 * series: [{ nome, valores: [n|null], projecao?: [n] }] (máx. 2), rotulos: ["jan/26", ...].
 */
export function linha(series, rotulos, { rotulosProjecao = [], casas = 1, sufixo = "", min, max, rotulo = "Gráfico de linha" } = {}) {
  const W = 360;
  const H = 180;
  const m = { t: 14, r: 12, b: 26, l: 34 };
  const total = rotulos.length + rotulosProjecao.length;
  const todos = series.flatMap((s) => [...s.valores, ...(s.projecao ?? [])]).filter((v) => v != null);
  const lo = min ?? Math.min(0, ...todos);
  let hi = max ?? Math.max(1, ...todos);
  if (hi === lo) hi = lo + 1;
  const x = (i) => m.l + (total <= 1 ? 0 : (i / (total - 1)) * (W - m.l - m.r));
  const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
  const g = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "g" });

  // Grade recessiva: 3 linhas.
  for (let k = 0; k <= 2; k++) {
    const v = lo + ((hi - lo) * k) / 2;
    g.append(svg("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: "g-grade" }), txt(m.l - 6, y(v) + 4, fmt(v, v % 1 ? 1 : 0), { "text-anchor": "end", class: "g-txt g-eixo" }));
  }
  // Rótulos do eixo x: no máximo 6.
  const passo = Math.ceil(total / 6);
  const mostrar = rotulosVisiveis(total, passo);
  [...rotulos, ...rotulosProjecao].forEach((r, i) => {
    if (mostrar(i)) g.append(txt(x(i), H - 8, r, { "text-anchor": "middle", class: `g-txt g-eixo${i >= rotulos.length ? " g-proj-txt" : ""}` }));
  });
  if (rotulosProjecao.length) {
    const x0 = x(rotulos.length - 1);
    g.append(svg("rect", { x: x0, y: m.t, width: W - m.r - x0, height: H - m.t - m.b, class: "g-zona-proj" }), txt(W - m.r - 3, H - m.b - 4, "projeção", { "text-anchor": "end", class: "g-txt g-proj-txt" }));
  }

  series.forEach((s, si) => {
    const classe = `g-serie-${si + 1}`;
    const pts = s.valores.map((v, i) => (v == null ? null : [x(i), y(v), v, rotulos[i]])).filter(Boolean);
    if (pts.length > 1) g.append(svg("polyline", { points: pts.map(([a, b]) => `${a},${b}`).join(" "), class: `g-linha ${classe}` }));
    if (s.projecao?.length && pts.length) {
      const ultimo = pts[pts.length - 1];
      const proj = s.projecao.map((v, i) => [x(rotulos.length + i), y(v), v, rotulosProjecao[i]]);
      g.append(svg("polyline", { points: [ultimo, ...proj].map(([a, b]) => `${a},${b}`).join(" "), class: `g-linha g-linha--proj ${classe}` }));
      for (const [a, b, v, r] of proj) {
        g.append(svg("g", { class: "g-alvo" }, titulo(`${s.nome} · ${r} (projeção): ${fmt(v, casas)}${sufixo}`), svg("circle", { cx: a, cy: b, r: 9, class: "g-hit" }), svg("circle", { cx: a, cy: b, r: 3.5, class: `g-ponto g-ponto--proj ${classe}` })));
      }
    }
    for (const [a, b, v, r] of pts) {
      g.append(svg("g", { class: "g-alvo" }, titulo(`${s.nome} · ${r}: ${fmt(v, casas)}${sufixo}`), svg("circle", { cx: a, cy: b, r: 9, class: "g-hit" }), svg("circle", { cx: a, cy: b, r: 4, class: `g-ponto ${classe}` })));
    }
    // Rótulo direto só no último ponto real.
    const ult = pts[pts.length - 1];
    if (ult) g.append(txt(Math.min(ult[0], W - m.r - 4), ult[1] - 9, `${fmt(ult[2], casas)}${sufixo}`, { "text-anchor": "end", class: "g-txt g-val" }));
  });

  let legenda = null;
  if (series.length > 1) {
    legenda = document.createElement("div");
    legenda.className = "g-legenda";
    series.forEach((s, i) => {
      const item = document.createElement("span");
      const marca = document.createElement("i");
      marca.className = `g-marca g-serie-${i + 1}`;
      item.append(marca, s.nome);
      legenda.append(item);
    });
  }
  return figura(g, legenda, rotulo);
}

/** Colunas mensais (ex.: saídas por mês). Uma série; projeção opcional em traço. */
export function colunas(valores, rotulos, { projecao = [], rotulosProjecao = [], casas = 0, sufixo = "", rotulo = "Gráfico de colunas", nome = "Valor" } = {}) {
  const W = 360;
  const H = 160;
  const m = { t: 18, r: 8, b: 26, l: 8 };
  const todos = [...valores, ...projecao];
  const total = todos.length;
  const hi = Math.max(1, ...todos.map((v) => v ?? 0));
  const slot = (W - m.l - m.r) / total;
  const larg = Math.max(4, Math.min(22, slot - 6));
  const g = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "g" });
  g.append(svg("line", { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: "g-base" }));
  const passo = Math.ceil(total / 6);
  todos.forEach((v, i) => {
    const proj = i >= valores.length;
    const r = proj ? rotulosProjecao[i - valores.length] : rotulos[i];
    const hgt = ((v ?? 0) / hi) * (H - m.t - m.b);
    const cx = m.l + slot * i + slot / 2;
    const grupo = svg("g", { class: "g-alvo" }, titulo(`${nome} · ${r}${proj ? " (projeção)" : ""}: ${fmt(v, casas)}${sufixo}`));
    grupo.append(svg("rect", { x: cx - slot / 2, y: m.t, width: slot, height: H - m.t - m.b, class: "g-hit" }));
    if (v) grupo.append(svg("rect", { x: cx - larg / 2, y: H - m.b - hgt, width: larg, height: Math.max(2, hgt), rx: 3, class: proj ? "g-coluna g-coluna--proj" : "g-coluna" }));
    if (v) grupo.append(txt(cx, H - m.b - hgt - 5, fmt(v, casas), { "text-anchor": "middle", class: "g-txt g-val g-val--peq" }));
    g.append(grupo);
    if (rotulosVisiveis(total, passo)(i)) g.append(txt(cx, H - 8, r, { "text-anchor": "middle", class: `g-txt g-eixo${proj ? " g-proj-txt" : ""}` }));
  });
  return figura(g, null, rotulo);
}

/** Medidor semicircular 0–100 (favorabilidade, progresso) ou −100..100 (eNPS). */
export function medidor(valor, { min = 0, max = 100, rotulo = "", sufixo = "" } = {}) {
  const W = 160;
  const H = 96;
  const r = 64;
  const cx = W / 2;
  const cy = 84;
  const frac = valor == null ? 0 : Math.max(0, Math.min(1, (valor - min) / (max - min)));
  const ang = Math.PI * (1 - frac);
  const arco = (f) => `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(Math.PI * (1 - f))} ${cy - r * Math.sin(Math.PI * (1 - f))}`;
  const g = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "g g--medidor" });
  g.append(svg("path", { d: arco(1), class: "g-trilho-arco" }));
  if (valor != null && frac > 0) g.append(svg("path", { d: arco(frac), class: "g-arco" }));
  g.append(svg("circle", { cx: cx + r * Math.cos(ang), cy: cy - r * Math.sin(ang), r: 5, class: "g-ponteiro" }));
  g.append(txt(cx, cy - 12, valor == null ? "—" : `${fmt(valor)}${sufixo}`, { "text-anchor": "middle", class: "g-txt g-medidor-valor" }));
  return figura(g, null, `${rotulo}: ${valor == null ? "sem dados" : `${fmt(valor)}${sufixo}`}`);
}
