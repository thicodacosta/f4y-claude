import "server-only";

import type { Contexto } from "@/lib/contexto";
import type { Escopo } from "@/lib/permissoes";

export const NENHUM = "00000000-0000-0000-0000-000000000000";

/**
 * O escopo de uma permissão cobre esta pessoa?
 *  todos  → qualquer pessoa da organização
 *  equipe → a própria pessoa ou quem tem o usuário como gestor direto
 *  próprio→ só a própria pessoa
 */
export function escopoCobre(ctx: Contexto, escopo: Escopo | null, pessoa: { id: string; gestorId: string | null }) {
  if (!escopo) return false;
  if (escopo === "todos") return true;
  const eu = ctx.colaboradorId;
  if (!eu) return false;
  if (pessoa.id === eu) return true;
  return escopo === "equipe" && pessoa.gestorId === eu;
}
