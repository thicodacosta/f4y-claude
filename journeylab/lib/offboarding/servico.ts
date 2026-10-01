import "server-only";

import type { Tx } from "@/lib/db";
import { respostasSchema } from "./questionario";

/** Grava as respostas e os campos derivados usados nos indicadores. */
export async function gravarRespostas(tx: Tx, desligamentoId: string, json: unknown, modo: "link" | "conduzida") {
  const r = respostasSchema.parse(json);
  await tx.desligamento.update({
    where: { id: desligamentoId },
    data: {
      respostas: r,
      motivosReais: r.motivos,
      motivoPrincipalReal: r.motivoPrincipal,
      enps: r.enps,
      voltaria: r.voltaria,
      evitavel: r.evitavel,
      entrevistaStatus: "respondida",
      entrevistaModo: modo,
      entrevistaRespondidaEm: new Date(),
      entrevistaErro: null,
    },
  });
  return r;
}
