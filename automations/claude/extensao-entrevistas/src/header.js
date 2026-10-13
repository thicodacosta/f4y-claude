/**
 * Logo do cabeçalho: sempre a marca Candydate (já está no HTML; aqui só se
 * garante que continue visível). A identidade da empresa do usuário
 * (Configurações) vai nos documentos gerados: currículos, PDFs e Motion.
 */
const LOGO = "icons/candydate-logo.png";

export function initHeader() {
  const img = document.getElementById("header-logo");
  if (!img) return;
  if (!img.getAttribute("src")) img.src = LOGO;
  img.alt = "Candydate";
  img.classList.add("topbar__logo--marca");
  img.hidden = false;
  // Arquivo indisponível (pacote incompleto): mostra o nome em texto.
  const emTexto = () => img.replaceWith(Object.assign(document.createElement("span"), { className: "topbar__brand", textContent: "Candydate" }));
  if (img.complete && img.naturalWidth === 0) emTexto();
  else img.addEventListener("error", emTexto, { once: true });
}
