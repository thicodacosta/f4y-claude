// Aplica o tema antes da página pintar, para não piscar. Lê a cópia síncrona
// em localStorage; a fonte da verdade é chrome.storage.local (ver src/theme.js).
try {
  const tema = localStorage.getItem("tema");
  if (tema === "light" || tema === "dark") document.documentElement.dataset.theme = tema;
} catch {
  // sem localStorage: segue o tema do sistema
}
