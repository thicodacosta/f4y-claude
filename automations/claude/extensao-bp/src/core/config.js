/** Endereço da página pública das pesquisas (Configurações > build). */
const EMBUTIDO = __BP_PUBLIC_URL__;

export async function urlPublica() {
  const { bpPublicUrl } = await chrome.storage.local.get("bpPublicUrl");
  return bpPublicUrl || EMBUTIDO || "";
}

export const urlPublicaEmbutida = EMBUTIDO;
