/** Configurações da integração com o LinkedIn (Configurações → LinkedIn). */

export const DEFAULT_NOTE =
  "Olá, {nome}! Atuo com recrutamento e busco {perfil} em {local}. Gostaria de me conectar para conversarmos sobre uma oportunidade. Abraço, {assinatura}";

export const DEFAULT_LINKEDIN_SETTINGS = {
  conectado: false,
  assinatura: "",
  incluirNota: true,
  personalizarNota: true,
  modeloNota: DEFAULT_NOTE,
  aderenciaMinima: 70,
  enviarSemNota: false,
};

export async function loadLinkedInSettings() {
  const { linkedin } = await chrome.storage.local.get("linkedin");
  return { ...DEFAULT_LINKEDIN_SETTINGS, ...linkedin };
}

export function saveLinkedInSettings(patch) {
  return loadLinkedInSettings().then((current) => chrome.storage.local.set({ linkedin: { ...current, ...patch } }));
}
