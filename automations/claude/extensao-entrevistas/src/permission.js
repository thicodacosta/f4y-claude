/**
 * Nem o painel lateral nem o offscreen document exibem de forma confiável o
 * aviso de permissão do microfone (achado do Candydate). Numa aba comum ele
 * sempre aparece, e a permissão vale para toda a extensão depois.
 */
import { getMicStream } from "./audio.js";
import { initHeader } from "./header.js";
import { initTheme } from "./theme.js";

initTheme();
initHeader();

const status = document.getElementById("status");

try {
  const stream = await getMicStream();
  stream.getTracks().forEach((t) => t.stop());
  status.textContent = "Microfone liberado. Pode fechar esta aba e clicar em “Iniciar gravação” no painel.";
} catch (error) {
  status.textContent =
    "O microfone não foi liberado. Clique no ícone de cadeado na barra de endereço, permita o microfone e recarregue esta página.";
  console.error(error);
}
