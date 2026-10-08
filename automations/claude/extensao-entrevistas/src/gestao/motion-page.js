/**
 * Página do Motion da Gestão (motion.html): toca a apresentação animada do
 * período, troca o formato, abre em tela cheia e exporta o vídeo. O roteiro
 * vem da aba Gestão (chrome.storage.session, chave `motionGestao`); o motor é
 * o da extensão BP (extensao-bp/src/motion/engine.js).
 */
import { FORMATOS, MotionPlayer } from "../../../extensao-bp/src/motion/engine.js";
import { requireAuth } from "../auth/gate.js";
import { initTheme } from "../theme.js";
import { $, saveBlob } from "../ui.js";

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

await initTheme();
await requireAuth();

const { motionGestao: doc } = await chrome.storage.session.get("motionGestao");
if (!doc?.roteiro) {
  $("estado").textContent = "Nenhuma apresentação para mostrar. Crie o Motion pela aba Gestão.";
} else {
  const { roteiro } = doc;
  const branding = (await chrome.storage.local.get("branding")).branding ?? {};
  const logo = await carregarImagem(branding.logoDataUrl);
  await document.fonts.load('700 40px "Geist"').catch(() => {});
  await document.fonts.load('600 40px "Inter"').catch(() => {});

  document.title = `${roteiro.titulo} · Motion`;
  $("titulo").textContent = roteiro.titulo;
  $("meta").textContent = [
    doc.origem === "base" ? "Roteiro montado direto dos dados" : `Roteiro por IA (${doc.origem === "groq" ? "Groq" : "Claude"})`,
    doc.briefing ? `Pedido: ${doc.briefing}` : null,
    doc.aviso,
  ]
    .filter(Boolean)
    .join(" · ");
  $("estado").hidden = true;
  $("palco").hidden = false;

  const formato = roteiro.opcoes?.formato in FORMATOS ? roteiro.opcoes.formato : "16:9";
  const player = new MotionPlayer($("canvas"), roteiro, { logo, empresa: branding.empresa || doc.empresa || "Candydate", kicker: doc.kicker ?? "", formato });
  $("palco").dataset.formato = formato;
  $("formato").value = formato;

  const botaoPlay = () => ($("play").textContent = player.tocando ? "Pausar" : "Reproduzir");
  player.aoAtualizar = (T) => {
    $("tempo").textContent = `${fmtTempo(T)} / ${fmtTempo(player.duracao)}`;
    $("linha").value = String(T / player.duracao);
  };
  player.aoTerminar = botaoPlay;
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
  });
  $("tela-cheia").addEventListener("click", () => $("canvas").requestFullscreen?.());
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.code === "Space") {
      e.preventDefault();
      $("play").click();
    }
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
    } catch (error) {
      console.error(error);
      $("status").textContent = "Não foi possível gravar o vídeo neste navegador.";
    } finally {
      botao.disabled = false;
      $("play").disabled = false;
      botao.textContent = "Baixar vídeo";
      botaoPlay();
    }
  });
}
