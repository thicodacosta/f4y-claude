import "server-only";

/**
 * Limite simples de tentativas por chave (janela deslizante, em memória do
 * processo). Protege rotas públicas contra abuso básico; em várias instâncias,
 * cada uma conta separadamente — a unicidade real é garantida no banco.
 */
const janelas = new Map<string, number[]>();

export function dentroDoLimite(chave: string, maximo: number, janelaMs: number) {
  const agora = Date.now();
  const recentes = (janelas.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  if (recentes.length >= maximo) {
    janelas.set(chave, recentes);
    return false;
  }
  recentes.push(agora);
  janelas.set(chave, recentes);
  if (janelas.size > 5000) for (const [k, v] of janelas) if (!v.some((t) => agora - t < janelaMs)) janelas.delete(k);
  return true;
}
