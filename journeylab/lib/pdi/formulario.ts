import "server-only";

import { textoDeData } from "@/lib/datas";
import { nomeFoco } from "./focos";
import type { PdiForm } from "./form";

/** Pessoas do escopo para o seletor do fluxo guiado (com cargo e departamento). */
export const SELECAO_PESSOA = { id: true, nome: true, cargo: true, equipe: { select: { nome: true, area: { select: { nome: true } } } } } as const;
export const pessoaParaForm = (p: { id: string; nome: string; cargo: string | null; equipe: { nome: string; area: { nome: string } | null } | null }) => ({
  id: p.id,
  nome: p.nome,
  cargo: p.cargo,
  departamento: p.equipe?.area?.nome ?? p.equipe?.nome ?? null,
});

type PdiCompleto = {
  id: string;
  colaboradorId: string;
  titulo: string;
  descricao: string | null;
  inicio: Date;
  fim: Date;
  focos: {
    id: string;
    focoChave: string;
    nomePersonalizado: string | null;
    descricao: string | null;
    importancia: string | null;
    objetivo: string | null;
    acoes: { id: string; descricao: string; tipo: string; responsavel: string; inicio: Date | null; prazo: Date | null; investimento: { toString(): string } | null; impacto: string | null; mentor: string | null }[];
  }[];
};

/** PDI gravado → estado do formulário de edição. */
export function formDoPdi(p: PdiCompleto): PdiForm {
  return {
    id: p.id,
    colaboradorId: p.colaboradorId,
    titulo: p.titulo,
    descricao: p.descricao ?? "",
    inicio: textoDeData(p.inicio),
    fim: textoDeData(p.fim),
    origem: "manual",
    focos: p.focos.map((f) => ({
      id: f.id,
      chaveLocal: f.id,
      chave: f.focoChave as PdiForm["focos"][number]["chave"],
      nomePersonalizado: f.focoChave === "outro" ? (f.nomePersonalizado ?? nomeFoco(f.focoChave)) : "",
      descricao: f.descricao ?? "",
      importancia: f.importancia ?? "",
      objetivo: f.objetivo ?? "",
      acoes: f.acoes.map((a) => ({
        id: a.id,
        chaveLocal: a.id,
        descricao: a.descricao,
        tipo: a.tipo as PdiForm["focos"][number]["acoes"][number]["tipo"],
        responsavel: a.responsavel as PdiForm["focos"][number]["acoes"][number]["responsavel"],
        inicio: a.inicio ? textoDeData(a.inicio) : "",
        prazo: a.prazo ? textoDeData(a.prazo) : "",
        investimento: a.investimento ? Number(a.investimento.toString()).toFixed(2).replace(".", ",") : "",
        impacto: a.impacto ?? "",
        mentor: a.mentor ?? "",
      })),
    })),
  };
}
