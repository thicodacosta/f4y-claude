/** Configurações da integração com o LinkedIn (Configurações → LinkedIn). */

export const DEFAULT_LINKEDIN_SETTINGS = {
  conectado: false,
  aderenciaMinima: 70,
};

export async function loadLinkedInSettings() {
  const { linkedin } = await chrome.storage.local.get("linkedin");
  return { ...DEFAULT_LINKEDIN_SETTINGS, ...linkedin };
}

export function saveLinkedInSettings(patch) {
  return loadLinkedInSettings().then((current) => chrome.storage.local.set({ linkedin: { ...current, ...patch } }));
}
