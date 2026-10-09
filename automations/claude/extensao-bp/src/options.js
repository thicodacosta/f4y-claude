/** Configurações do BP: identidade, página pública, chaves de IA e conta. */
import { urlPublicaEmbutida } from "./core/config.js";
import { aoMudar, carregar, iniciarEmpresa, renomearEmpresa } from "./core/db.js";
import { secaoColaboradores } from "./modulos/colaboradores-config.js";
import { secaoDemo } from "./modulos/demo-config.js";
import { hasEmbeddedKeys, initTheme, logout, requireAuth } from "./core/toolskit.js";
import { $ } from "./core/ui.js";
import { corDoLogo } from "./core/marca.js";

await initTheme();
const user = await requireAuth({ nomeProduto: "BP" });
$("conta-email").textContent = user ? `Conectado como ${user.email}` : "Sem login configurado neste pacote.";
$("conta-sair").addEventListener("click", logout);

// ─── Identidade ────────────────────────────────────────────────────────────

let branding = (await chrome.storage.local.get("branding")).branding ?? { cor: "#0E7AB8" };
const empresaId = user ? await iniciarEmpresa(branding.empresa).catch(() => null) : null;

// ─── Colaboradores ─────────────────────────────────────────────────────────

if (empresaId) {
  try {
    await carregar();
    const secao = secaoColaboradores();
    $("colaboradores-area").replaceChildren(secao.raiz);
    aoMudar(secao.desenharLista);
    $("demo-area").replaceChildren(secaoDemo().raiz);
    if (location.hash === "#colaboradores") $("colaboradores").scrollIntoView();
    if (location.hash === "#demo") setTimeout(() => $("demo").scrollIntoView({ block: "start" }), 200);
  } catch (e) {
    console.error(e);
    $("colaboradores-area").textContent = e.message ?? "Não foi possível carregar os colaboradores.";
  }
} else {
  $("colaboradores-area").textContent = "Entre com a sua conta para cadastrar colaboradores.";
}

function previa() {
  const box = $("logo-previa");
  box.replaceChildren(branding.logoDataUrl ? Object.assign(document.createElement("img"), { src: branding.logoDataUrl, alt: "Logo atual" }) : Object.assign(document.createElement("span"), { className: "hint", textContent: "Nenhum logo" }));
  $("logo-remover").hidden = !branding.logoDataUrl;
}
$("empresa").value = branding.empresa ?? "";
$("cor").value = branding.cor ?? "#0E7AB8";
$("cor-valor").textContent = $("cor").value.toUpperCase();
previa();

const lerArquivo = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});
const tamanho = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
  img.src = src;
});

$("logo-btn").addEventListener("click", () => $("logo-arquivo").click());
$("logo-arquivo").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024) return ($("identidade-status").textContent = "O logo precisa ter até 1 MB.");
  const logoDataUrl = await lerArquivo(file);
  const { width, height } = await tamanho(logoDataUrl);
  branding = { ...branding, logoDataUrl, logoType: file.type === "image/png" ? "png" : "jpg", logoWidth: width, logoHeight: height };
  previa();
  // Cor da marca sugerida a partir do logo (pode ser trocada antes de salvar).
  const sugerida = await corDoLogo(logoDataUrl);
  if (sugerida) {
    $("cor").value = sugerida;
    $("cor-valor").textContent = sugerida.toUpperCase();
  }
  $("identidade-status").textContent = sugerida ? "Cor da marca sugerida a partir do logo. Clique em Salvar para aplicar." : "Clique em Salvar para aplicar.";
});
$("logo-remover").addEventListener("click", () => {
  const { logoDataUrl, logoType, logoWidth, logoHeight, ...resto } = branding;
  branding = resto;
  previa();
});
$("cor").addEventListener("input", () => ($("cor-valor").textContent = $("cor").value.toUpperCase()));
$("identidade").addEventListener("submit", async (e) => {
  e.preventDefault();
  const empresa = $("empresa").value.trim();
  if (!empresa) return ($("identidade-status").textContent = "Informe o nome da empresa.");
  branding = { ...branding, empresa, cor: $("cor").value };
  await chrome.storage.local.set({ branding });
  if (empresaId) await renomearEmpresa(empresa).catch(() => {});
  $("identidade-status").textContent = "Identidade salva.";
});

// ─── Página pública ────────────────────────────────────────────────────────

const { bpPublicUrl } = await chrome.storage.local.get("bpPublicUrl");
$("url-publica").value = bpPublicUrl || urlPublicaEmbutida || "";
$("publica").addEventListener("submit", async (e) => {
  e.preventDefault();
  const valor = $("url-publica").value.trim();
  try {
    if (valor) {
      const u = new URL(valor);
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    }
  } catch {
    return ($("publica-status").textContent = "Informe um endereço válido, começando com https://");
  }
  await chrome.storage.local.set({ bpPublicUrl: valor });
  $("publica-status").textContent = valor ? "Endereço salvo. Os links das pesquisas usam este endereço." : "Endereço removido.";
});

// ─── Chaves (só quando o pacote não traz as embutidas) ─────────────────────

if (!hasEmbeddedKeys) {
  $("chaves").hidden = false;
  const atuais = await chrome.storage.local.get(["apiKey", "groqKey"]);
  $("apiKey").value = atuais.apiKey ?? "";
  $("groqKey").value = atuais.groqKey ?? "";
  $("chaves-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const apiKey = $("apiKey").value.trim();
    const groqKey = $("groqKey").value.trim();
    if (apiKey && !apiKey.startsWith("sk-ant-")) return ($("chaves-status").textContent = "A chave da Anthropic começa com sk-ant-.");
    if (groqKey && !groqKey.startsWith("gsk_")) return ($("chaves-status").textContent = "A chave da Groq começa com gsk_.");
    await chrome.storage.local.set({ apiKey, groqKey });
    $("chaves-status").textContent = "Chaves salvas.";
  });
}
