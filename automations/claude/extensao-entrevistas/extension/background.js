// Clicar no ícone abre o painel lateral: ele continua aberto enquanto o
// recrutador troca de aba, então a análise não se perde no meio do caminho.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!apiKey) chrome.runtime.openOptionsPage();
});
