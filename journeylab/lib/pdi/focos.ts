/**
 * PDI — catálogo de focos de desenvolvimento e ponte com o Feedback 1:1.
 * Puro (servidor e cliente). As chaves são estáveis e gravadas no banco
 * (focos_pdi.foco_chave, CHECK na migração): os nomes podem evoluir sem
 * quebrar registros antigos.
 */
import { TODOS_CRITERIOS, type Notas } from "@/lib/feedback/avaliacao";

export const FOCOS = [
  { chave: "visao_negocio", nome: "Visão de negócio" },
  { chave: "pensamento_critico", nome: "Pensamento crítico" },
  { chave: "networking", nome: "Networking" },
  { chave: "inovacao", nome: "Inovação" },
  { chave: "analise_dados", nome: "Análise de dados" },
  { chave: "resiliencia", nome: "Resiliência" },
  { chave: "estudo_continuo", nome: "Estudo contínuo" },
  { chave: "foco_concentracao", nome: "Foco e concentração" },
  { chave: "negociacao", nome: "Negociação" },
  { chave: "resolucao_conflitos", nome: "Resolução de conflitos" },
  { chave: "mentoria", nome: "Mentoria" },
  { chave: "escrita_assertiva", nome: "Escrita assertiva" },
  { chave: "agilidade", nome: "Agilidade" },
  { chave: "gestao_projetos", nome: "Gestão de projetos" },
  { chave: "delegacao", nome: "Delegação" },
  { chave: "tomada_decisao", nome: "Tomada de decisão" },
  { chave: "produtividade", nome: "Produtividade" },
  { chave: "performance", nome: "Performance" },
  { chave: "comunicacao", nome: "Comunicação" },
  { chave: "gestao_tempo", nome: "Gestão do tempo" },
  { chave: "lideranca", nome: "Liderança" },
  { chave: "outro", nome: "Outro" },
] as const;

export type FocoChave = (typeof FOCOS)[number]["chave"];
export const CHAVES_FOCO = FOCOS.map((f) => f.chave) as [FocoChave, ...FocoChave[]];
const NOMES = Object.fromEntries(FOCOS.map((f) => [f.chave, f.nome])) as Record<string, string>;

/** Nome exibido: o do catálogo ou o personalizado (Outro). Chave desconhecida não quebra a tela. */
export function nomeFoco(chave: string, nomePersonalizado?: string | null) {
  if (chave === "outro") return nomePersonalizado?.trim() || "Outro";
  return NOMES[chave] ?? nomePersonalizado ?? chave;
}

/** Critério do Feedback 1:1 → foco coerente do catálogo. */
export const FOCO_DO_CRITERIO: Record<string, FocoChave> = {
  produtividade: "produtividade",
  qualidade: "performance",
  ferramentas: "estudo_continuo",
  priorizacao: "tomada_decisao",
  tempo: "gestao_tempo",
  aprendizado: "estudo_continuo",
  relacionamento: "networking",
  comunicacao: "comunicacao",
  criatividade: "inovacao",
  confianca: "comunicacao",
  resultado: "performance",
  sensoDono: "visao_negocio",
  adaptabilidade: "agilidade",
  resiliencia: "resiliencia",
  longoPrazo: "visao_negocio",
  colaboracao: "networking",
};

export type Prioridade = "critica" | "atencao";
export const PRIORIDADE: Record<Prioridade, { nome: string; tom: "perigo" | "alerta" }> = {
  critica: { nome: "Prioridade crítica", tom: "perigo" },
  atencao: { nome: "Prioridade de atenção", tom: "alerta" },
};

export type SugestaoFoco = {
  chave: FocoChave;
  prioridade: Prioridade;
  nota: number;
  criterios: { nome: string; nota: number }[];
  /** Objetivo sugerido (comportamento esperado) — sempre editável; nunca uma meta de nota. */
  objetivo: string;
};

/**
 * Sugestões de foco a partir de um feedback na escala 1–5: só notas 1 e 2
 * (1 = prioridade crítica; 2 = atenção — organização das sugestões, não rótulo
 * da pessoa), ordenadas pela menor nota, sem focos repetidos, no máximo `limite`.
 */
export function sugerirFocos(notas: Notas, limite = 3): SugestaoFoco[] {
  const baixos = TODOS_CRITERIOS.map((c) => ({ c, nota: notas[c.campo] }))
    .filter((x): x is { c: (typeof TODOS_CRITERIOS)[number]; nota: number } => typeof x.nota === "number" && x.nota >= 1 && x.nota <= 2)
    .sort((a, b) => a.nota - b.nota);
  const porFoco = new Map<FocoChave, SugestaoFoco>();
  for (const { c, nota } of baixos) {
    const chave = FOCO_DO_CRITERIO[c.chave];
    if (!chave) continue;
    const atual = porFoco.get(chave);
    if (atual) atual.criterios.push({ nome: c.nome, nota });
    else porFoco.set(chave, { chave, prioridade: nota === 1 ? "critica" : "atencao", nota, criterios: [{ nome: c.nome, nota }], objetivo: c.focoPdi });
  }
  return [...porFoco.values()].slice(0, limite);
}
