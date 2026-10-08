/**
 * Motor do Motion: desenha o roteiro em <canvas> quadro a quadro, com tempo
 * contínuo (play, pausa, busca) e exportação em vídeo (MediaRecorder sobre
 * captureStream). Formatos 16:9, 9:16 e 1:1, com tudo proporcional ao lado
 * menor (unidade `u`).
 *
 * Linguagem visual Candy Studio: fundo zinc-950 com um mesh suave de luzes
 * índigo/violeta/ciano em movimento lento, tipografia Geist (títulos) e Inter
 * (texto), entradas em fade + slide-up com ease-out, contadores, barras e
 * linhas que se desenham, e transição por cortina índigo entre as cenas.
 */

const COR = {
  fundo0: "#09090B", // zinc-950
  fundo1: "#18181B", // zinc-900
  acento: "#6366F1", // indigo-500
  acento2: "#A5B4FC", // indigo-300 (destaques e projeções)
  texto: "#FAFAFA",
  suave: "#A1A1AA", // zinc-400
  linha: "rgba(255,255,255,0.10)",
  cartao: "rgba(255,255,255,0.055)",
};
const DISPLAY = 'Geist, Inter, system-ui, sans-serif';
const CORPO = 'Inter, system-ui, sans-serif';
const TRANSICAO = 0.75;

export const FORMATOS = { "16:9": [1920, 1080], "9:16": [1080, 1920], "1:1": [1080, 1080] };

// ─── Utilidades ───────────────────────────────────────────────────────────

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (x) => 1 - (1 - clamp(x)) ** 3;
const easeInOut = (x) => {
  x = clamp(x);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
const easeBack = (x) => {
  x = clamp(x);
  const c1 = 1.5;
  return 1 + (c1 + 1) * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};
/** Progresso suavizado de uma animação que começa em `ini` e dura `dur`. */
const p = (t, ini, dur = 0.7, ease = easeOut) => ease((t - ini) / dur);

function fonte(ctx, tamanho, peso = 600, familia = CORPO) {
  // Geist é carregada até o peso 700 (títulos do design system: 600–700).
  if (familia === DISPLAY && peso > 700) peso = 700;
  ctx.font = `${peso} ${Math.round(tamanho)}px ${familia}`;
}

function quebrar(ctx, texto, largura) {
  const linhas = [];
  for (const paragrafo of String(texto ?? "").split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (ctx.measureText(teste).width > largura && atual) {
        linhas.push(atual);
        atual = palavra;
      } else atual = teste;
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

/** Texto com quebra; devolve a altura usada. */
function texto(ctx, str, x, y, { tamanho, peso = 500, familia = CORPO, cor = COR.texto, alinhar = "left", largura = 1e9, entrelinha = 1.25, alfa = 1, maxLinhas = 6 }) {
  if (!str) return 0;
  fonte(ctx, tamanho, peso, familia);
  const linhas = quebrar(ctx, str, largura).slice(0, maxLinhas);
  ctx.save();
  ctx.globalAlpha *= alfa;
  ctx.fillStyle = cor;
  ctx.textAlign = alinhar;
  ctx.textBaseline = "alphabetic";
  linhas.forEach((l, i) => ctx.fillText(l, x, y + tamanho + i * tamanho * entrelinha));
  ctx.restore();
  return linhas.length * tamanho * entrelinha;
}

/**
 * Título cinético: palavras sobem e aparecem em sequência. Devolve a altura.
 */
function tituloCinetico(ctx, str, x, y, t, ini, { tamanho, largura, cor = COR.texto, alinhar = "left", passo = 0.055, peso = 800 }) {
  if (!str) return 0;
  fonte(ctx, tamanho, peso, DISPLAY);
  const linhas = quebrar(ctx, str, largura).slice(0, 4);
  const lh = tamanho * 1.08;
  let k = 0;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  linhas.forEach((linha, li) => {
    const palavras = linha.split(" ");
    const larguraLinha = ctx.measureText(linha).width;
    let cx = alinhar === "center" ? x - larguraLinha / 2 : alinhar === "right" ? x - larguraLinha : x;
    const espaco = ctx.measureText(" ").width;
    for (const w of palavras) {
      const q = p(t, ini + k * passo, 0.6);
      ctx.globalAlpha = q;
      ctx.fillStyle = cor;
      ctx.fillText(w, cx, y + tamanho + li * lh + (1 - q) * tamanho * 0.45);
      cx += ctx.measureText(w).width + espaco;
      k++;
    }
  });
  ctx.restore();
  return linhas.length * lh;
}

/** Interpola o primeiro número de um texto ("R$ 45.300", "12,5%", "-20"). */
export function contar(str, frac) {
  if (str == null) return "";
  const m = String(str).match(/-?\d[\d.]*(?:,\d+)?|-?\d+(?:\.\d+)?/);
  if (!m || frac >= 1) return String(str);
  const bruto = m[0];
  const temVirgula = bruto.includes(",");
  const milhar = temVirgula || /\.\d{3}(?!\d)/.test(bruto);
  const num = Number(milhar ? bruto.replace(/\./g, "").replace(",", ".") : bruto);
  if (!Number.isFinite(num)) return String(str);
  const casas = temVirgula ? bruto.split(",")[1].length : milhar ? 0 : (bruto.split(".")[1] ?? "").length;
  const v = num * easeOut(frac);
  const fmt = v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas, useGrouping: milhar || Math.abs(num) >= 10000 });
  return String(str).replace(bruto, fmt);
}

function retangulo(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function cartao(ctx, x, y, w, h, u, alfa = 1) {
  ctx.save();
  ctx.globalAlpha *= alfa;
  retangulo(ctx, x, y, w, h, 28 * u);
  ctx.fillStyle = COR.cartao;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2 * u;
  ctx.stroke();
  ctx.restore();
}

function kicker(ctx, str, x, y, t, L, alinhar = "left") {
  const q = p(t, 0.05, 0.6);
  ctx.save();
  ctx.globalAlpha = q;
  fonte(ctx, 24 * L.u, 700, CORPO);
  ctx.fillStyle = COR.acento2;
  ctx.textAlign = alinhar;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${4 * L.u}px`;
  ctx.fillText(String(str ?? "").toUpperCase(), x + (alinhar === "left" ? (1 - q) * -30 * L.u : 0), y);
  ctx.restore();
}

/** Cabeçalho padrão das cenas de conteúdo: título + subtítulo. Devolve o y livre. */
function cabecalho(ctx, cena, t, L) {
  const { M, u, topo } = L;
  let y = topo;
  const h = tituloCinetico(ctx, cena.titulo, M, y, t, 0.1, { tamanho: (L.vertical ? 68 : 72) * u, largura: L.W - 2 * M, peso: 800 });
  y += h + 18 * u;
  if (cena.subtitulo) y += texto(ctx, cena.subtitulo, M, y, { tamanho: 30 * u, cor: COR.suave, largura: L.W - 2 * M, alfa: p(t, 0.5, 0.6), maxLinhas: 2 }) + 10 * u;
  // Fio de acento que cresce sob o título.
  ctx.save();
  ctx.fillStyle = COR.acento;
  ctx.fillRect(M, y + 6 * u, 120 * u * p(t, 0.45, 0.8), 6 * u);
  ctx.restore();
  return y + 60 * u;
}

// ─── Cenas ────────────────────────────────────────────────────────────────

const CENAS = {
  abertura(ctx, c, t, L, ctxR) {
    const { M, u, W, H } = L;
    // Anéis decorativos girando.
    ctx.save();
    const cx = L.vertical ? W * 0.82 : W * 0.83;
    const cy = L.vertical ? H * 0.2 : H * 0.5;
    for (let i = 0; i < 3; i++) {
      const r = (L.vertical ? 260 : 330) * u * (1 - i * 0.24);
      const ini = -Math.PI / 2 + t * (0.25 + i * 0.12) * (i % 2 ? -1 : 1);
      ctx.beginPath();
      ctx.arc(cx, cy, r, ini, ini + Math.PI * 2 * p(t, 0.1 + i * 0.15, 1.6, easeInOut) * (0.55 + i * 0.15));
      ctx.strokeStyle = i === 0 ? COR.acento : `rgba(165,180,252,${0.35 - i * 0.1})`;
      ctx.lineWidth = (i === 0 ? 10 : 4) * u;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.restore();

    const larg = (L.vertical ? W - 2 * M : W * 0.62);
    const y0 = L.vertical ? H * 0.42 : H * 0.3;
    kicker(ctx, ctxR.kicker, M, y0, t, L);
    const ht = tituloCinetico(ctx, c.titulo, M, y0 + 30 * u, t, 0.3, { tamanho: (L.vertical ? 104 : 116) * u, largura: larg });
    ctx.fillStyle = COR.acento;
    ctx.fillRect(M, y0 + 60 * u + ht, 200 * u * p(t, 0.9, 0.9), 8 * u);
    texto(ctx, c.subtitulo, M, y0 + 96 * u + ht, { tamanho: 38 * u, cor: COR.suave, largura: larg, alfa: p(t, 1.2, 0.8), maxLinhas: 3 });
  },

  numeros(ctx, c, t, L) {
    const { M, u, W } = L;
    const y = cabecalho(ctx, c, t, L);
    const itens = c.itens.slice(0, 4);
    const n = itens.length || 1;
    const colunas = L.vertical ? (n > 2 ? 2 : 1) : L.quadrado ? 2 : n;
    const linhas = Math.ceil(n / colunas);
    const gap = 28 * u;
    const w = (W - 2 * M - gap * (colunas - 1)) / colunas;
    const h = Math.min(330 * u, (L.H - y - L.base - gap * (linhas - 1)) / linhas);
    itens.forEach((it, i) => {
      const x = M + (i % colunas) * (w + gap);
      const yy = y + Math.floor(i / colunas) * (h + gap);
      const q = p(t, 0.55 + i * 0.16, 0.7, easeBack);
      ctx.save();
      ctx.translate(x + w / 2, yy + h / 2);
      ctx.scale(0.9 + 0.1 * q, 0.9 + 0.1 * q);
      ctx.translate(-(x + w / 2), -(yy + h / 2));
      cartao(ctx, x, yy, w, h, u, clamp(q * 1.4));
      ctx.fillStyle = it.destaque ? COR.acento2 : COR.acento;
      ctx.globalAlpha = clamp(q);
      ctx.fillRect(x + 36 * u, yy + 36 * u, 70 * u * p(t, 0.8 + i * 0.16, 0.6), 6 * u);
      texto(ctx, it.rotulo, x + 36 * u, yy + 56 * u, { tamanho: 28 * u, cor: COR.suave, largura: w - 72 * u, maxLinhas: 2, peso: 600 });
      const valor = contar(it.valorTexto ?? (it.valor != null ? String(it.valor).replace(".", ",") : "—"), p(t, 0.7 + i * 0.16, 1.4, (x) => x));
      const tam = Math.min(104 * u, ((w - 72 * u) / Math.max(4, valor.length)) * 1.45);
      fonte(ctx, tam, 800, DISPLAY);
      ctx.fillStyle = COR.texto;
      ctx.textAlign = "left";
      ctx.fillText(valor, x + 36 * u, yy + h - 44 * u);
      ctx.restore();
    });
  },

  barras(ctx, c, t, L) {
    const { M, u, W } = L;
    const y = cabecalho(ctx, c, t, L);
    const itens = c.itens.filter((i) => i.valor != null).slice(0, 7);
    if (!itens.length) return CENAS.topicos(ctx, c, t, L);
    const ehPct = itens.some((i) => /%/.test(i.valorTexto ?? ""));
    const ehNota = itens.every((i) => i.valor >= 0 && i.valor <= 5) && !ehPct;
    const max = ehPct ? Math.max(100, ...itens.map((i) => i.valor)) : ehNota ? 5 : Math.max(...itens.map((i) => i.valor)) * 1.08 || 1;
    const disponivel = L.H - y - L.base;
    const linha = Math.min(118 * u, disponivel / itens.length);
    const rot = L.vertical ? 0 : (W - 2 * M) * 0.3;
    const xb = M + rot;
    const wb = W - M - xb - 150 * u;
    itens.forEach((it, i) => {
      const yy = y + i * linha;
      const q = p(t, 0.5 + i * 0.12, 1.1);
      const alfa = p(t, 0.4 + i * 0.12, 0.5);
      if (L.vertical) {
        texto(ctx, it.rotulo, M, yy - 4 * u, { tamanho: 28 * u, cor: COR.suave, alfa, largura: W - 2 * M, maxLinhas: 1, peso: 600 });
      } else {
        texto(ctx, it.rotulo, xb - 28 * u, yy + linha / 2 - 26 * u, { tamanho: 30 * u, cor: COR.suave, alfa, alinhar: "right", largura: rot - 40 * u, maxLinhas: 1, peso: 600 });
      }
      const by = L.vertical ? yy + 40 * u : yy + linha / 2 - 14 * u;
      const bh = 28 * u;
      ctx.save();
      ctx.globalAlpha = alfa;
      retangulo(ctx, xb, by, wb, bh, bh / 2);
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fill();
      const w = Math.max(bh, (it.valor / max) * wb * q);
      retangulo(ctx, xb, by, w, bh, bh / 2);
      const grad = ctx.createLinearGradient(xb, 0, xb + w, 0);
      grad.addColorStop(0, it.destaque ? COR.acento2 : "rgba(99,102,241,0.65)");
      grad.addColorStop(1, it.destaque ? "#C7D2FE" : COR.acento);
      ctx.fillStyle = grad;
      ctx.fill();
      fonte(ctx, 36 * u, 800, DISPLAY);
      ctx.fillStyle = COR.texto;
      ctx.textAlign = "left";
      ctx.fillText(contar(it.valorTexto ?? String(it.valor).replace(".", ","), q), xb + w + 22 * u, by + bh - 2 * u);
      ctx.restore();
    });
  },

  evolucao(ctx, c, t, L) {
    const { M, u, W } = L;
    const y = cabecalho(ctx, c, t, L);
    const pts = c.itens.filter((i) => i.valor != null);
    if (pts.length < 2) return CENAS.numeros(ctx, c, t, L);
    const x0 = M + 70 * u;
    const x1 = W - M - 20 * u;
    const y0 = y + 30 * u;
    const y1 = L.H - L.base - 70 * u;
    const vals = pts.map((i) => i.valor);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    // Variação pequena perto de valores positivos: eixo a partir do zero, para
    // não dramatizar oscilações mínimas (ex.: headcount 16 → 17).
    if (lo >= 0 && (hi - lo) / (hi || 1) < 0.25) lo = 0;
    const folga = (hi - lo || Math.abs(hi) || 1) * 0.2;
    lo = lo >= 0 && lo - folga < 0 ? 0 : lo - folga;
    hi += folga;
    const X = (i) => x0 + (i / (pts.length - 1)) * (x1 - x0);
    const Y = (v) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);

    // Grade e rótulos.
    ctx.save();
    ctx.globalAlpha = p(t, 0.3, 0.6);
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 2 * u;
    for (let k = 0; k <= 3; k++) {
      const yy = y0 + ((y1 - y0) * k) / 3;
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.lineTo(x1, yy);
      ctx.stroke();
      const v = hi - ((hi - lo) * k) / 3;
      fonte(ctx, 22 * u, 500);
      ctx.fillStyle = COR.suave;
      ctx.textAlign = "right";
      ctx.fillText(Math.abs(v) >= 100 ? Math.round(v).toLocaleString("pt-BR") : v.toFixed(1).replace(".", ","), x0 - 16 * u, yy + 8 * u);
    }
    const passo = Math.ceil(pts.length / (L.vertical ? 4 : 7));
    pts.forEach((pt, i) => {
      if (i % passo && i !== pts.length - 1) return;
      fonte(ctx, 22 * u, pt.destaque ? 600 : 500);
      ctx.fillStyle = pt.destaque ? COR.acento2 : COR.suave;
      ctx.textAlign = "center";
      ctx.fillText(pt.rotulo, X(i), y1 + 40 * u);
    });
    const primeiroProj = pts.findIndex((pt) => pt.destaque);
    if (primeiroProj > 0) {
      const xp = X(primeiroProj - 1);
      ctx.fillStyle = "rgba(165,180,252,0.06)";
      ctx.fillRect(xp, y0, x1 - xp + 10 * u, y1 - y0);
      fonte(ctx, 22 * u, 700);
      ctx.fillStyle = COR.acento2;
      ctx.textAlign = "right";
      ctx.fillText("PROJEÇÃO", x1, y0 + 26 * u);
    }
    ctx.restore();

    // Linha desenhada progressivamente.
    const q = p(t, 0.6, 1.8, easeInOut);
    const alcance = q * (pts.length - 1);
    const real = primeiroProj > 0 ? primeiroProj - 1 : pts.length - 1;
    const tracar = (de, ate, tracejado) => {
      ctx.beginPath();
      for (let i = de; i <= Math.min(ate, Math.floor(alcance)); i++) {
        if (i === de) ctx.moveTo(X(i), Y(pts[i].valor));
        else ctx.lineTo(X(i), Y(pts[i].valor));
      }
      const f = alcance - Math.floor(alcance);
      const i = Math.floor(alcance);
      if (i >= de && i < ate && f > 0) ctx.lineTo(X(i) + (X(i + 1) - X(i)) * f, Y(pts[i].valor) + (Y(pts[i + 1].valor) - Y(pts[i].valor)) * f);
      ctx.setLineDash(tracejado ? [16 * u, 14 * u] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    // Área sob a parte real.
    ctx.save();
    ctx.globalAlpha = 0.9 * q;
    const area = ctx.createLinearGradient(0, y0, 0, y1);
    area.addColorStop(0, "rgba(99,102,241,0.30)");
    area.addColorStop(1, "rgba(99,102,241,0)");
    ctx.beginPath();
    ctx.moveTo(X(0), y1);
    for (let i = 0; i <= Math.min(real, Math.floor(alcance)); i++) ctx.lineTo(X(i), Y(pts[i].valor));
    ctx.lineTo(X(Math.min(real, Math.floor(alcance))), y1);
    ctx.closePath();
    ctx.fillStyle = area;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(99,102,241,0.6)";
    ctx.shadowBlur = 24 * u;
    ctx.strokeStyle = COR.acento;
    ctx.lineWidth = 8 * u;
    tracar(0, real, false);
    if (real < pts.length - 1) {
      ctx.strokeStyle = COR.acento2;
      ctx.lineWidth = 6 * u;
      tracar(real, pts.length - 1, true);
    }
    ctx.restore();

    pts.forEach((pt, i) => {
      const qq = clamp((alcance - i + 0.3) * 2);
      if (qq <= 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(X(i), Y(pt.valor), (pt.destaque ? 9 : 11) * u * easeBack(qq), 0, Math.PI * 2);
      ctx.fillStyle = pt.destaque ? COR.fundo1 : COR.texto;
      ctx.strokeStyle = pt.destaque ? COR.acento2 : COR.acento;
      ctx.lineWidth = 5 * u;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
    // Valor do último ponto real em balão.
    const ult = pts[real];
    const qb = p(t, 0.6 + 1.8 * (real / (pts.length - 1)), 0.6, easeBack);
    if (qb > 0) {
      const rot = ult.valorTexto ?? String(ult.valor).replace(".", ",");
      fonte(ctx, 34 * u, 800, DISPLAY);
      const bw = ctx.measureText(rot).width + 40 * u;
      const bx = clamp(X(real) - bw / 2, x0, x1 - bw);
      const by = Y(ult.valor) - 92 * u;
      ctx.save();
      ctx.globalAlpha = qb;
      retangulo(ctx, bx, by, bw, 62 * u, 18 * u);
      ctx.fillStyle = COR.acento;
      ctx.fill();
      ctx.fillStyle = COR.fundo0;
      ctx.textAlign = "center";
      ctx.fillText(rot, bx + bw / 2, by + 44 * u);
      ctx.restore();
    }
  },

  topicos(ctx, c, t, L) {
    const { M, u, W } = L;
    let y = cabecalho(ctx, c, t, L);
    const itens = c.itens.slice(0, 5);
    const disponivel = L.H - y - L.base;
    const tam = Math.min(40 * u, disponivel / Math.max(1, itens.length) / 2.6);
    itens.forEach((it, i) => {
      const ini = 0.6 + i * 0.42;
      const q = p(t, ini, 0.6);
      ctx.save();
      ctx.globalAlpha = q;
      ctx.translate((1 - q) * 50 * u, 0);
      const r = tam * 0.95;
      ctx.beginPath();
      ctx.arc(M + r, y + r + 2 * u, r, 0, Math.PI * 2);
      ctx.fillStyle = COR.acento;
      ctx.fill();
      fonte(ctx, tam * 0.9, 800, DISPLAY);
      ctx.fillStyle = COR.fundo0;
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), M + r, y + r + tam * 0.33);
      const h = texto(ctx, it.rotulo, M + r * 2 + 30 * u, y - tam * 0.15, { tamanho: tam, peso: 600, largura: W - 2 * M - r * 2 - 30 * u, maxLinhas: 3 });
      ctx.restore();
      y += Math.max(h, r * 2) + tam * 0.9;
    });
    if (c.texto) texto(ctx, c.texto, M, y + 10 * u, { tamanho: 28 * u, cor: COR.suave, largura: W - 2 * M, alfa: p(t, 0.6 + itens.length * 0.42, 0.6), maxLinhas: 3 });
  },

  destaque(ctx, c, t, L) {
    const { u, W, H } = L;
    const cx = W / 2;
    const cy = H / 2;
    for (let i = 0; i < 3; i++) {
      const q = clamp((t - 0.4 - i * 0.25) / 2.2);
      if (q <= 0) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, (220 + 420 * easeOut(q)) * u, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(99,102,241,${0.45 * (1 - q)})`;
      ctx.lineWidth = 4 * u;
      ctx.stroke();
    }
    kicker(ctx, c.titulo, cx, cy - 210 * u, t, L, "center");
    const it = c.itens[0];
    const grande = it?.valorTexto ?? (it?.valor != null ? String(it.valor).replace(".", ",") : it?.rotulo) ?? "";
    const q = p(t, 0.35, 0.9, easeBack);
    const mostrar = contar(grande, p(t, 0.35, 1.6, (x) => x));
    let tam = (L.vertical ? 200 : 230) * u;
    fonte(ctx, tam, 800, DISPLAY);
    const larg = ctx.measureText(mostrar).width;
    if (larg > W - 2 * L.M) tam *= (W - 2 * L.M) / larg;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.7 + 0.3 * q, 0.7 + 0.3 * q);
    ctx.globalAlpha = clamp(q);
    fonte(ctx, tam, 800, DISPLAY);
    const grad = ctx.createLinearGradient(-larg / 2, 0, larg / 2, 0);
    grad.addColorStop(0, COR.texto);
    grad.addColorStop(1, COR.acento2);
    ctx.fillStyle = grad;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(mostrar, 0, 0);
    ctx.restore();
    if (it?.valorTexto && it?.rotulo) texto(ctx, it.rotulo, cx, cy + tam * 0.45, { tamanho: 34 * u, peso: 600, cor: COR.suave, alinhar: "center", largura: W - 2 * L.M, alfa: p(t, 1.1, 0.6), maxLinhas: 2 });
    texto(ctx, c.texto ?? c.subtitulo, cx, cy + tam * 0.45 + 70 * u, { tamanho: 32 * u, cor: COR.texto, alinhar: "center", largura: (W - 2 * L.M) * 0.85, alfa: p(t, 1.4, 0.7), maxLinhas: 3 });
  },

  citacao(ctx, c, t, L) {
    const { M, u, W, H } = L;
    ctx.save();
    ctx.globalAlpha = 0.9 * p(t, 0.1, 0.8);
    fonte(ctx, 360 * u, 800, DISPLAY);
    ctx.fillStyle = COR.acento;
    ctx.fillText("“", M - 20 * u, H * 0.42);
    ctx.restore();
    const frase = c.texto ?? c.itens[0]?.rotulo ?? c.titulo;
    const h = tituloCinetico(ctx, frase, M, H * 0.36, t, 0.4, { tamanho: (L.vertical ? 62 : 66) * u, largura: W - 2 * M, peso: 700, passo: 0.07 });
    ctx.fillStyle = COR.acento;
    ctx.fillRect(M, H * 0.36 + h + 50 * u, 80 * u * p(t, 1.2, 0.6), 5 * u);
    texto(ctx, c.titulo, M, H * 0.36 + h + 76 * u, { tamanho: 30 * u, cor: COR.suave, alfa: p(t, 1.4, 0.6), peso: 600, largura: W - 2 * M });
  },

  comparativo(ctx, c, t, L) {
    const { M, u, W } = L;
    const y = cabecalho(ctx, c, t, L);
    const [a, b] = c.itens;
    if (!a || !b) return CENAS.topicos(ctx, c, t, L);
    const gap = 120 * u;
    const vert = L.vertical;
    const w = vert ? W - 2 * M : (W - 2 * M - gap) / 2;
    const h = vert ? (L.H - y - L.base - gap) / 2 : Math.min(420 * u, L.H - y - L.base);
    [a, b].forEach((it, i) => {
      const x = vert ? M : M + i * (w + gap);
      const yy = vert ? y + i * (h + gap) : y;
      const q = p(t, 0.5 + i * 0.5, 0.7, easeBack);
      ctx.save();
      ctx.globalAlpha = clamp(q);
      cartao(ctx, x, yy, w, h, u);
      if (i === 1) {
        retangulo(ctx, x, yy, w, h, 28 * u);
        ctx.strokeStyle = COR.acento;
        ctx.lineWidth = 3 * u;
        ctx.stroke();
      }
      texto(ctx, it.rotulo, x + 44 * u, yy + 40 * u, { tamanho: 30 * u, cor: COR.suave, peso: 600, largura: w - 88 * u, maxLinhas: 2 });
      const v = contar(it.valorTexto ?? (it.valor != null ? String(it.valor).replace(".", ",") : "—"), p(t, 0.6 + i * 0.5, 1.3, (x) => x));
      fonte(ctx, Math.min(130 * u, (w - 88 * u) / Math.max(3, v.length) * 1.7), 800, DISPLAY);
      ctx.fillStyle = i === 1 ? COR.acento2 : COR.texto;
      ctx.fillText(v, x + 44 * u, yy + h - 56 * u);
      ctx.restore();
    });
    // Seta entre os dois.
    const q = p(t, 0.9, 0.6);
    ctx.save();
    ctx.globalAlpha = q;
    ctx.strokeStyle = COR.acento;
    ctx.lineWidth = 6 * u;
    ctx.lineCap = "round";
    const ax = vert ? W / 2 : M + w + gap / 2;
    const ay = vert ? y + h + gap / 2 : y + h / 2;
    ctx.beginPath();
    if (vert) {
      ctx.moveTo(ax, ay - 30 * u);
      ctx.lineTo(ax, ay - 30 * u + 60 * u * q);
      ctx.moveTo(ax - 20 * u, ay + 10 * u);
      ctx.lineTo(ax, ay + 30 * u);
      ctx.lineTo(ax + 20 * u, ay + 10 * u);
    } else {
      ctx.moveTo(ax - 34 * u, ay);
      ctx.lineTo(ax - 34 * u + 68 * u * q, ay);
      ctx.moveTo(ax + 14 * u, ay - 20 * u);
      ctx.lineTo(ax + 34 * u, ay);
      ctx.lineTo(ax + 14 * u, ay + 20 * u);
    }
    ctx.stroke();
    ctx.restore();
    if (c.texto) texto(ctx, c.texto, M, L.H - L.base - 10 * u, { tamanho: 28 * u, cor: COR.suave, largura: W - 2 * M, alfa: p(t, 1.6, 0.6), maxLinhas: 2 });
  },

  etapas(ctx, c, t, L) {
    const { M, u, W } = L;
    const y = cabecalho(ctx, c, t, L);
    const itens = c.itens.slice(0, 5);
    const n = itens.length || 1;
    if (L.vertical || L.quadrado) {
      const passo = (L.H - y - L.base) / n;
      ctx.save();
      ctx.strokeStyle = "rgba(99,102,241,0.5)";
      ctx.lineWidth = 4 * u;
      ctx.beginPath();
      ctx.moveTo(M + 28 * u, y + 28 * u);
      ctx.lineTo(M + 28 * u, y + 28 * u + (passo * (n - 1)) * p(t, 0.5, 0.4 * n, easeInOut));
      ctx.stroke();
      ctx.restore();
      itens.forEach((it, i) => {
        const q = p(t, 0.55 + i * 0.4, 0.6, easeBack);
        const yy = y + i * passo;
        ctx.save();
        ctx.globalAlpha = clamp(q);
        ctx.beginPath();
        ctx.arc(M + 28 * u, yy + 28 * u, 28 * u * q, 0, Math.PI * 2);
        ctx.fillStyle = COR.acento;
        ctx.fill();
        fonte(ctx, 28 * u, 800, DISPLAY);
        ctx.fillStyle = COR.fundo0;
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1), M + 28 * u, yy + 38 * u);
        texto(ctx, it.rotulo, M + 84 * u, yy, { tamanho: 36 * u, peso: 600, largura: W - 2 * M - 84 * u, maxLinhas: 2 });
        if (it.valorTexto) texto(ctx, it.valorTexto, M + 84 * u, yy + 48 * u, { tamanho: 26 * u, cor: COR.suave, largura: W - 2 * M - 84 * u, maxLinhas: 2 });
        ctx.restore();
      });
      return;
    }
    const cy = y + (L.H - y - L.base) * 0.32;
    const x0 = M + 40 * u;
    const x1 = W - M - 40 * u;
    const X = (i) => (n === 1 ? (x0 + x1) / 2 : x0 + (i / (n - 1)) * (x1 - x0));
    ctx.save();
    ctx.strokeStyle = "rgba(99,102,241,0.5)";
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.moveTo(x0, cy);
    ctx.lineTo(x0 + (x1 - x0) * p(t, 0.5, 0.45 * n, easeInOut), cy);
    ctx.stroke();
    ctx.restore();
    const larg = Math.min(380 * u, (x1 - x0) / Math.max(1, n - 1) - 20 * u);
    itens.forEach((it, i) => {
      const q = p(t, 0.55 + i * 0.45, 0.6, easeBack);
      ctx.save();
      ctx.globalAlpha = clamp(q);
      ctx.beginPath();
      ctx.arc(X(i), cy, 34 * u * q, 0, Math.PI * 2);
      ctx.fillStyle = COR.acento;
      ctx.fill();
      fonte(ctx, 32 * u, 800, DISPLAY);
      ctx.fillStyle = COR.fundo0;
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), X(i), cy + 11 * u);
      texto(ctx, it.rotulo, X(i), cy + 60 * u, { tamanho: 32 * u, peso: 600, alinhar: "center", largura: larg, maxLinhas: 3 });
      if (it.valorTexto) texto(ctx, it.valorTexto, X(i), cy + 190 * u, { tamanho: 26 * u, cor: COR.suave, alinhar: "center", largura: larg, maxLinhas: 3 });
      ctx.restore();
    });
  },

  encerramento(ctx, c, t, L, ctxR) {
    const { u, W, H } = L;
    const cx = W / 2;
    let y = H * 0.36;
    if (ctxR.logo) {
      const q = p(t, 0.1, 0.8, easeBack);
      const lh = 110 * u;
      const lw = Math.min(460 * u, (ctxR.logo.width / ctxR.logo.height) * lh);
      ctx.save();
      ctx.globalAlpha = clamp(q);
      retangulo(ctx, cx - lw / 2 - 30 * u, y - 30 * u, lw + 60 * u, lh + 60 * u, 30 * u);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.drawImage(ctxR.logo, cx - lw / 2, y, lw, lh);
      ctx.restore();
      y += lh + 110 * u;
    } else {
      kicker(ctx, ctxR.empresa, cx, y + 20 * u, t, L, "center");
      y += 70 * u;
    }
    const h = tituloCinetico(ctx, c.titulo, cx, y, t, 0.5, { tamanho: (L.vertical ? 84 : 92) * u, largura: W - 2 * L.M, alinhar: "center" });
    ctx.fillStyle = COR.acento;
    const lw = 160 * u * p(t, 1, 0.7);
    ctx.fillRect(cx - lw / 2, y + h + 34 * u, lw, 6 * u);
    texto(ctx, c.subtitulo ?? c.texto, cx, y + h + 64 * u, { tamanho: 34 * u, cor: COR.suave, alinhar: "center", largura: (W - 2 * L.M) * 0.85, alfa: p(t, 1.2, 0.7), maxLinhas: 3 });
  },
};

// ─── Fundo, moldura e transição ───────────────────────────────────────────

function fundo(ctx, T, L) {
  const { W, H, u } = L;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, COR.fundo1);
  g.addColorStop(1, COR.fundo0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Luzes em movimento lento.
  const luzes = [
    [0.15, 0.15, 0.55, "rgba(79,70,229,0.28)", 0.11], // indigo
    [0.85, 0.85, 0.6, "rgba(124,58,237,0.22)", 0.08], // violet
    [0.75, 0.2, 0.35, "rgba(6,182,212,0.10)", 0.15], // cyan
  ];
  for (const [px, py, r, cor, vel] of luzes) {
    const x = W * px + Math.sin(T * vel * 2) * 140 * u;
    const y = H * py + Math.cos(T * vel * 1.6) * 110 * u;
    const raio = Math.max(W, H) * r;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, raio);
    rg.addColorStop(0, cor);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
  // Malha de pontos com leve deslocamento.
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  const passo = 60 * u;
  const off = (T * 6 * u) % passo;
  for (let x = -passo + off; x < W + passo; x += passo) for (let y = -passo + off * 0.5; y < H + passo; y += passo) ctx.fillRect(x, y, 2.4 * u, 2.4 * u);
  ctx.restore();
}

function moldura(ctx, L, ctxR, T, total, indice, nCenas) {
  const { W, H, u, M } = L;
  // Marca no topo.
  ctx.save();
  if (ctxR.logo) {
    const lh = 46 * u;
    const lw = Math.min(260 * u, (ctxR.logo.width / ctxR.logo.height) * lh);
    retangulo(ctx, M - 16 * u, 44 * u, lw + 32 * u, lh + 24 * u, 14 * u);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.fill();
    ctx.drawImage(ctxR.logo, M, 56 * u, lw, lh);
  } else {
    fonte(ctx, 26 * u, 700, DISPLAY);
    ctx.fillStyle = COR.texto;
    ctx.fillText(ctxR.empresa, M, 84 * u);
  }
  fonte(ctx, 22 * u, 600, CORPO);
  ctx.fillStyle = COR.suave;
  ctx.textAlign = "right";
  ctx.fillText(`${String(indice + 1).padStart(2, "0")} / ${String(nCenas).padStart(2, "0")}`, W - M, 84 * u);
  // Barra de progresso.
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(M, H - 56 * u, W - 2 * M, 4 * u);
  ctx.fillStyle = COR.acento;
  ctx.fillRect(M, H - 56 * u, (W - 2 * M) * clamp(T / total), 4 * u);
  ctx.restore();
}

// ─── Player ───────────────────────────────────────────────────────────────

export class MotionPlayer {
  constructor(canvas, roteiro, { logo = null, empresa = "", kicker = "", formato = "16:9" } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.roteiro = roteiro;
    this.ctxR = { logo, empresa, kicker };
    this.t = 0;
    this.tocando = false;
    this.aoAtualizar = null;
    this.aoTerminar = null;
    this.definirFormato(formato);
    this._loop = this._loop.bind(this);
  }

  definirFormato(formato) {
    const [W, H] = FORMATOS[formato] ?? FORMATOS["16:9"];
    this.canvas.width = W;
    this.canvas.height = H;
    const u = Math.min(W, H) / 1080;
    const vertical = H > W;
    this.L = { W, H, u, vertical, quadrado: W === H, M: (vertical ? 80 : W === H ? 90 : 140) * u, topo: (vertical ? 220 : 170) * u, base: (vertical ? 160 : 120) * u };
    this.formato = formato;
    this.desenhar();
  }

  get cenas() {
    return this.roteiro.cenas;
  }

  get duracao() {
    return this.cenas.reduce((s, c) => s + c.duracao, 0);
  }

  inicioDe(i) {
    return this.cenas.slice(0, i).reduce((s, c) => s + c.duracao, 0);
  }

  cenaEm(T) {
    let acc = 0;
    for (let i = 0; i < this.cenas.length; i++) {
      if (T < acc + this.cenas[i].duracao || i === this.cenas.length - 1) return { i, t: T - acc };
      acc += this.cenas[i].duracao;
    }
    return { i: 0, t: 0 };
  }

  desenharCena(i, t) {
    const c = this.cenas[i];
    const fn = CENAS[c.tipo] ?? CENAS.topicos;
    this.ctx.save();
    fn(this.ctx, c, t, this.L, this.ctxR);
    this.ctx.restore();
  }

  desenhar(T = this.t) {
    const { ctx, L } = this;
    const total = this.duracao;
    const { i, t } = this.cenaEm(Math.min(T, total - 1e-6));
    ctx.save();
    ctx.textAlign = "left";
    fundo(ctx, T, L);
    if (i > 0 && t < TRANSICAO) {
      // Cortina: a cena anterior (congelada no fim) sai pela direita.
      const q = easeInOut(t / TRANSICAO);
      const xCorte = q * (L.W + 200 * L.u) - 100 * L.u;
      ctx.save();
      ctx.beginPath();
      ctx.rect(xCorte, 0, L.W - xCorte, L.H);
      ctx.clip();
      this.desenharCena(i - 1, this.cenas[i - 1].duracao);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, Math.max(0, xCorte), L.H);
      ctx.clip();
      fundo(ctx, T, L);
      this.desenharCena(i, t);
      ctx.restore();
      const grad = ctx.createLinearGradient(xCorte - 90 * L.u, 0, xCorte + 10 * L.u, 0);
      grad.addColorStop(0, "rgba(99,102,241,0)");
      grad.addColorStop(1, COR.acento);
      ctx.fillStyle = grad;
      ctx.fillRect(xCorte - 90 * L.u, 0, 100 * L.u, L.H);
    } else {
      this.desenharCena(i, t);
    }
    moldura(ctx, L, this.ctxR, T, total, i, this.cenas.length);
    // Saída final em fade.
    const fim = clamp((T - (total - 0.8)) / 0.8);
    if (fim > 0) {
      ctx.fillStyle = `rgba(9,9,11,${fim})`;
      ctx.fillRect(0, 0, L.W, L.H);
    }
    ctx.restore();
  }

  _loop(agora) {
    if (!this.tocando) return;
    const dt = this._ultimo ? (agora - this._ultimo) / 1000 : 0;
    this._ultimo = agora;
    this.t = Math.min(this.duracao, this.t + dt);
    this.desenhar();
    this.aoAtualizar?.(this.t);
    if (this.t >= this.duracao) {
      this.tocando = false;
      this.aoTerminar?.();
      return;
    }
    requestAnimationFrame(this._loop);
  }

  tocar() {
    if (this.t >= this.duracao) this.t = 0;
    this.tocando = true;
    this._ultimo = 0;
    requestAnimationFrame(this._loop);
  }

  pausar() {
    this.tocando = false;
  }

  ir(T) {
    this.t = clamp(T, 0, this.duracao);
    this.desenhar();
    this.aoAtualizar?.(this.t);
  }

  /**
   * Grava o vídeo inteiro em tempo real. Prefere MP4 (H.264) quando o Chrome
   * oferece; senão WebM (VP9). Devolve { blob, extensao }.
   */
  async gravar(aoProgresso) {
    const tipos = ["video/mp4;codecs=avc1.640028", "video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
    const mimeType = tipos.find((m) => MediaRecorder.isTypeSupported(m));
    const stream = this.canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: this.L.W * this.L.H > 2e6 ? 12_000_000 : 8_000_000 });
    const partes = [];
    rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
    const parado = new Promise((r) => (rec.onstop = r));
    this.pausar();
    this.ir(0);
    rec.start(250);
    await new Promise((resolve) => {
      const inicio = performance.now();
      const passo = () => {
        const T = (performance.now() - inicio) / 1000;
        this.t = Math.min(this.duracao, T);
        this.desenhar();
        aoProgresso?.(this.t / this.duracao);
        if (T >= this.duracao + 0.2) return resolve();
        requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
    rec.stop();
    await parado;
    stream.getTracks().forEach((tr) => tr.stop());
    const mime = mimeType.split(";")[0];
    return { blob: new Blob(partes, { type: mime }), extensao: mime === "video/mp4" ? "mp4" : "webm" };
  }
}
