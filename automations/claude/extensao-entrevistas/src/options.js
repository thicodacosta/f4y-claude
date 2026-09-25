const $ = (id) => document.getElementById(id);

function setStatus(message) {
  $("status").textContent = message;
}

const { apiKey } = await chrome.storage.local.get("apiKey");
if (apiKey) {
  $("apiKey").placeholder = `Chave salva (termina em …${apiKey.slice(-4)})`;
}

$("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = $("apiKey").value.trim();
  if (!value.startsWith("sk-ant-")) {
    setStatus("A chave deve começar com “sk-ant-”.");
    $("apiKey").focus();
    return;
  }
  await chrome.storage.local.set({ apiKey: value });
  $("apiKey").value = "";
  $("apiKey").placeholder = `Chave salva (termina em …${value.slice(-4)})`;
  setStatus("Chave salva. Já pode gerar registros pelo painel lateral.");
});

$("clear-btn").addEventListener("click", async () => {
  await chrome.storage.local.remove("apiKey");
  $("apiKey").value = "";
  $("apiKey").placeholder = "sk-ant-…";
  setStatus("Chave removida deste navegador.");
});
