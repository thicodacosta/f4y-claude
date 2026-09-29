import "server-only";

import { formatarData } from "@/lib/formato";
import { textoDeData } from "@/lib/datas";
import type { Escopo } from "@/lib/permissoes";
import type { TarefaCliente } from "@/components/onboarding/tarefas";
import { sinais, type StatusTarefa } from "./calculo";
import { podeAtualizarTarefa } from "./regras";

type TarefaDb = {
  id: string;
  titulo: string;
  status: StatusTarefa;
  responsavelTipo: "rh" | "gestor" | "colaborador";
  responsavel: { nome: string } | null;
  prazo: Date;
  bloqueioMotivo: string | null;
  obrigatoria: boolean;
  fase: { nome: string };
};

/** Tarefa → formato do cliente (datas como texto, permissões já resolvidas no servidor). */
export function serializarTarefa(t: TarefaDb, hoje: Date, escopoConcluir: Escopo | null, emAndamento: boolean): TarefaCliente {
  return {
    id: t.id,
    titulo: t.titulo,
    fase: t.fase.nome,
    status: t.status,
    responsavelTipo: t.responsavelTipo,
    responsavelNome: t.responsavel?.nome ?? null,
    prazo: textoDeData(t.prazo),
    prazoRotulo: `prazo ${formatarData(t.prazo)}`,
    bloqueioMotivo: t.bloqueioMotivo,
    obrigatoria: t.obrigatoria,
    sinais: emAndamento ? sinais(t, hoje) : { atrasada: false, venceHoje: false, proxima: false, bloqueada: t.status === "bloqueada" },
    podeAtualizar: podeAtualizarTarefa(escopoConcluir, t),
  };
}
