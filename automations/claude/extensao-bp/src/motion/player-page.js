/**
 * Página do Motion (motion.html?id=<documento>): toca a apresentação, troca
 * o formato, permite ajustar os textos de cada cena e exporta o vídeo.
 */
import { initTheme, requireAuth, saveBlob, supabase } from "../core/toolskit.js";
import { h, $ } from "../core/ui.js";
import { FORMATOS, MotionPlayer } from "./engine.js";
import { OPCOES } from "./roteiro.js";
import { COR_PADRAO, LOGO_PADRAO, corDoLogo, paletaDe } from "../core/marca.js";

const id = new URLSearchParams(location.search).get("id");
let doc = null;
let player = null;

const NOME_CENA = { abertura: "Abertura", numeros: "Números", barras: "Barras", evolucao: "Evolução", topicos: "Tópicos", destaque: "Destaque", citacao: "Citação", comparativo: "Comparativo", etapas: "Etapas", encerramento: "Encerramento" };
const fmtTempo = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function carregarImagem(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function carregarDocumento() {
  const sessao = (await chrome.storage.session.get(`motion:${id}`))[`motion:${id}`];
  if (sessao) return sessao;
  const { data, error } = await supabase.from("bp_documentos").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

function atualizarTempo(T) {
  $("tempo").textContent = `${fmtTempo(T)} / ${fmtTempo(player.duracao)}`;
  $("linha").value = String(T / player.duracao);
  const { i } = player.cenaEm(T);
  for (const [k, item] of [...$("cenas").children].entries()) item.classList.toggle("is-atual", k === i);
}

function botaoPlay() {
  $("play").textContent = player.tocando ? "Pausar" : "Reproduzir";
}

function listaCenas() {
  $("cenas").replaceChildren(
    ...player.cenas.map((c, i) =>
      h(
        "li",
        { class: "cena" },
        h("button", { type: "button", class: "cena__ir", onclick: () => player.ir(player.inicioDe(i) + 0.01 + (i ? 0.8 : 0)) }, `${String(i + 1).padStart(2, "0")} · ${NOME_CENA[c.tipo] ?? c.tipo}`),
        h("input", {
          class: "cena__titulo",
          value: c.titulo,
          "aria-label": `Título da cena ${i + 1}`,
          oninput: (e) => {
            c.titulo = e.target.value;
            if (!player.tocando) player.desenhar();
            $("salvar").disabled = false;
          },
        }),
        h("input", {
          class: "cena__sub",
          value: c.subtitulo ?? c.texto ?? "",
          placeholder: "Subtítulo / frase de apoio",
          "aria-label": `Subtítulo da cena ${i + 1}`,
          oninput: (e) => {
            if (c.texto != null && c.subtitulo == null) c.texto = e.target.value;
            else c.subtitulo = e.target.value || null;
            if (!player.tocando) player.desenhar();
            $("salvar").disabled = false;
          },
        }),
        h(
          "label",
          { class: "cena__dur" },
          "Duração ",
          h("input", {
            type: "number",
            min: "2.8",
            max: "12",
            step: "0.5",
            value: String(c.duracao),
            onchange: (e) => {
              c.duracao = Math.min(12, Math.max(2.8, Number(e.target.value) || c.duracao));
              e.target.value = String(c.duracao);
              player.ir(Math.min(player.t, player.duracao));
              $("salvar").disabled = false;
            },
          }),
          " s",
        ),
      ),
    ),
  );
}

async function init() {
  await initTheme();
  await requireAuth({ nomeProduto: "BP" });
  if (!id) return ($("estado").textContent = "Motion não encontrado.");
  try {
    doc = await carregarDocumento();
  } catch (e) {
    console.error(e);
    $("estado").textContent = "Não foi possível abrir este Motion.";
    return;
  }
  const roteiro = doc.conteudo.roteiro;
  const branding = (await chrome.storage.local.get("branding")).branding ?? {};
  // Logo da empresa (ou, sem ele, o Candydate) e cores da marca: a cor
  // escolhida em Configurações ou, sem ela, a predominante do logo.
  const logoSrc = branding.logoDataUrl || LOGO_PADRAO;
  const logo = await carregarImagem(logoSrc);
  const corMarca = branding.cor || (await corDoLogo(logoSrc)) || COR_PADRAO;
  const tema = paletaDe(corMarca);
  await document.fonts.load('700 40px "Geist"').catch(() => {});
  await document.fonts.load('600 40px "Inter"').catch(() => {});

  document.title = `${roteiro.titulo} · Motion`;
  $("titulo").textContent = roteiro.titulo;
  $("meta").textContent = [doc.conteudo.origem === "base" ? "Roteiro montado dos dados" : `Roteiro por IA (${doc.conteudo.origem === "groq" ? "Groq" : "Claude"})`, OPCOES.publico[roteiro.opcoes?.publico], OPCOES.tom[roteiro.opcoes?.tom]].filter(Boolean).join(" · ");
  if (doc.conteudo.briefing) $("briefing").textContent = `Pedido: ${doc.conteudo.briefing}`;
  $("estado").hidden = true;
  $("palco").hidden = false;

  const formato = roteiro.opcoes?.formato in FORMATOS ? roteiro.opcoes.formato : "16:9";
  player = new MotionPlayer($("canvas"), roteiro, { logo, empresa: branding.empresa || doc.conteudo.empresa || "Candydate", kicker: doc.conteudo.kicker ?? "", formato, tema });
  $("palco").dataset.formato = formato;
  $("formato").value = formato;
  player.aoAtualizar = atualizarTempo;
  player.aoTerminar = botaoPlay;
  listaCenas();
  atualizarTempo(0);
  player.tocar();
  botaoPlay();

  $("play").addEventListener("click", () => {
    if (player.tocando) player.pausar();
    else player.tocar();
    botaoPlay();
  });
  $("reiniciar").addEventListener("click", () => {
    player.ir(0);
    player.tocar();
    botaoPlay();
  });
  $("linha").addEventListener("input", (e) => {
    player.pausar();
    botaoPlay();
    player.ir(Number(e.target.value) * player.duracao);
  });
  $("formato").addEventListener("change", (e) => {
    player.definirFormato(e.target.value);
    $("palco").dataset.formato = e.target.value;
    roteiro.opcoes = { ...roteiro.opcoes, formato: e.target.value };
    $("salvar").disabled = false;
  });
  $("tela-cheia").addEventListener("click", () => $("canvas").requestFullscreen?.());
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.code === "Space") {
      e.preventDefault();
      $("play").click();
    }
  });

  $("salvar").addEventListener("click", async () => {
    $("salvar").disabled = true;
    const conteudo = { ...doc.conteudo, roteiro };
    const { error } = await supabase.from("bp_documentos").update({ conteudo }).eq("id", doc.id);
    $("status").textContent = error ? "Não foi possível salvar as alterações." : "Alterações salvas.";
    if (error) $("salvar").disabled = false;
  });

  $("baixar").addEventListener("click", async () => {
    const botao = $("baixar");
    botao.disabled = true;
    $("play").disabled = true;
    $("status").textContent = "Gravando o vídeo em tempo real: mantenha esta aba visível…";
    try {
      const { blob, extensao } = await player.gravar((f) => (botao.textContent = `Gravando… ${Math.round(f * 100)}%`));
      saveBlob(blob, `${roteiro.titulo.replace(/[\\/:*?"<>|]/g, "-")} (${player.formato.replace(":", "x")}).${extensao}`);
      $("status").textContent = `Vídeo ${extensao.toUpperCase()} baixado.`;
    } catch (e) {
      console.error(e);
      $("status").textContent = "Não foi possível gravar o vídeo neste navegador.";
    } finally {
      botao.disabled = false;
      $("play").disabled = false;
      botao.textContent = "Baixar vídeo";
      botaoPlay();
    }
  });
}

await init();
