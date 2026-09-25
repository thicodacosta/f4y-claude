const $ = (id) => document.getElementById(id);

// Campo do formulário → chave em chrome.storage.local, com o prefixo esperado.
const KEYS = [
  { field: "apiKey", prefix: "sk-ant-", name: "Anthropic" },
  { field: "groqKey", prefix: "gsk_", name: "Groq" },
];

function setStatus(message) {
  $("status").textContent = message;
}

function showSaved(stored) {
  for (const { field, prefix } of KEYS) {
    $(field).value = "";
    $(field).placeholder = stored[field] ? `Chave salva (termina em …${stored[field].slice(-4)})` : `${prefix}…`;
  }
}

showSaved(await chrome.storage.local.get(KEYS.map((k) => k.field)));

$("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const updates = {};
  for (const { field, prefix, name } of KEYS) {
    const value = $(field).value.trim();
    if (!value) continue;
    if (!value.startsWith(prefix)) {
      setStatus(`A chave da ${name} deve começar com “${prefix}”.`);
      $(field).focus();
      return;
    }
    updates[field] = value;
  }
  if (Object.keys(updates).length === 0) {
    setStatus("Nenhuma chave nova para salvar.");
    return;
  }
  await chrome.storage.local.set(updates);
  showSaved(await chrome.storage.local.get(KEYS.map((k) => k.field)));
  setStatus("Chaves salvas. Já pode usar o painel lateral.");
});

$("clear-btn").addEventListener("click", async () => {
  await chrome.storage.local.remove(KEYS.map((k) => k.field));
  showSaved({});
  setStatus("Chaves removidas deste navegador.");
});
