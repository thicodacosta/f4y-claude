/** Estado do formulário guiado do PDI (puro: servidor e cliente). */
import type { FocoChave } from "./focos";
import type { ResponsavelAcao, TipoAcao } from "./calculo";

export type AcaoForm = {
  id?: string;
  chaveLocal: string;
  descricao: string;
  tipo: TipoAcao | "";
  responsavel: ResponsavelAcao | "";
  inicio: string;
  prazo: string;
  investimento: string;
  impacto: string;
  mentor: string;
};
export type FocoForm = {
  id?: string;
  chaveLocal: string;
  chave: FocoChave;
  nomePersonalizado: string;
  descricao: string;
  importancia: string;
  objetivo: string;
  acoes: AcaoForm[];
};
export type PdiForm = {
  id?: string;
  colaboradorId: string;
  titulo: string;
  descricao: string;
  inicio: string;
  fim: string;
  origem: "manual" | "feedback" | "onboarding";
  origemId?: string;
  focos: FocoForm[];
};
let seq = 0;
const local = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;
export const acaoVazia = (inicio = ""): AcaoForm => ({ chaveLocal: local(), descricao: "", tipo: "", responsavel: "", inicio, prazo: "", investimento: "", impacto: "", mentor: "" });
export const focoVazio = (chave: FocoChave, extra: Partial<FocoForm> = {}): FocoForm => ({ chaveLocal: local(), chave, nomePersonalizado: "", descricao: "", importancia: "", objetivo: "", acoes: [], ...extra });

