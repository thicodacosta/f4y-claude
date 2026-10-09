/**
 * Marca da empresa para o Motion: logo (o da empresa ou, sem ele, o
 * Candydate) e uma paleta derivada da cor da marca (Configurações) ou, sem
 * ela, da cor predominante do logo.
 */

export const COR_PADRAO = "#28AAF0"; // azul Candydate

const hexParaRgb = (hex) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbParaHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

function rgbParaHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslParaHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbParaHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** "rgba(r,g,b,a)" de uma cor hex. */
export const rgba = (hex, a) => `rgba(${hexParaRgb(hex).join(",")},${a})`;

/**
 * Paleta do Motion a partir de uma cor: acento vivo e legível sobre fundo
 * escuro, um tom claro para destaques/projeções, um segundo tom (matiz
 * vizinho) para as luzes e um fundo noturno tingido pela própria cor.
 */
export function paletaDe(cor = COR_PADRAO) {
  const [h, s0] = rgbParaHsl(...hexParaRgb(cor));
  // Cores quase cinza (logo preto, por exemplo) ganham saturação mínima.
  const s = Math.max(s0, 0.45);
  return {
    acento: hslParaHex(h, Math.min(0.9, s), 0.56),
    acento2: hslParaHex(h, Math.min(0.85, s), 0.82),
    luz2: hslParaHex((h + 35) % 360, Math.min(0.6, s), 0.5),
    fundo0: hslParaHex(h, Math.min(0.55, s), 0.06),
    fundo1: hslParaHex(h, Math.min(0.5, s), 0.13),
  };
}

/** Cor predominante (não branca, não preta, não transparente) de uma imagem. */
export async function corDoLogo(src) {
  if (!src) return null;
  const img = await new Promise((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = src;
  });
  if (!img) return null;
  const w = 64;
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const dados = ctx.getImageData(0, 0, w, h).data;
  const caixas = new Map();
  for (let i = 0; i < dados.length; i += 4) {
    const [r, g, b, a] = [dados[i], dados[i + 1], dados[i + 2], dados[i + 3]];
    if (a < 160) continue;
    const [, sat, lum] = rgbParaHsl(r, g, b);
    if (lum > 0.93 || lum < 0.08 || sat < 0.18) continue;
    const chave = `${r >> 4},${g >> 4},${b >> 4}`;
    const c = caixas.get(chave) ?? { n: 0, r: 0, g: 0, b: 0 };
    caixas.set(chave, { n: c.n + 1, r: c.r + r, g: c.g + g, b: c.b + b });
  }
  const [melhor] = [...caixas.values()].sort((x, y) => y.n - x.n);
  return melhor ? rgbParaHex(melhor.r / melhor.n, melhor.g / melhor.n, melhor.b / melhor.n) : null;
}

/** Logo Candydate empacotado (icons/candydate-logo.png). */
export const LOGO_PADRAO = "icons/candydate-logo.png";
