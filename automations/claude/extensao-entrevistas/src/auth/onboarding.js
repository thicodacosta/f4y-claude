/**
 * Primeiro acesso por usuário: a configuração inicial (identidade e LinkedIn)
 * fica marcada com o id de quem a concluiu. Outro usuário no mesmo navegador
 * passa de novo pela configuração. Sem login configurado, vale um "true".
 */
export async function isOnboarded(user) {
  const { onboardingDone } = await chrome.storage.local.get("onboardingDone");
  return user ? onboardingDone === user.id : Boolean(onboardingDone);
}

export function markOnboarded(user) {
  return chrome.storage.local.set({ onboardingDone: user ? user.id : true });
}
