/**
 * Feedback 1:1 avaliado — definições e regras puras (servidor e cliente).
 * A regra oficial de médias e semáforo roda no banco (jl_calcular_avaliacao em
 * prisma/rls.sql); calcularMedias() usa a MESMA fórmula para a prévia na tela
 * e para validação no servidor. Testes E2E conferem que as duas coincidem.
 */
import { diasEntre, somarDias } from "@/lib/datas";

export type Criterio = { chave: string; campo: string; nome: string; descricao: string; pergunta: string; focoPdi: string };

export const CRITERIOS_PERFORMANCE: Criterio[] = [
  { chave: "produtividade", campo: "pProdutividade", nome: "Produtividade", descricao: "Volume e constância das entregas.", pergunta: "O que mais tem tomado seu tempo e impedido de avançar nas entregas?", focoPdi: "Aumentar a constância e o volume de entregas" },
  { chave: "qualidade", campo: "pQualidade", nome: "Qualidade nas Entregas", descricao: "Precisão, cuidado e retrabalho.", pergunta: "Que tipo de ajuste mais aparece nas suas entregas? O que ajudaria a antecipá-lo?", focoPdi: "Elevar a qualidade das entregas e reduzir retrabalho" },
  { chave: "ferramentas", campo: "pFerramentas", nome: "Ferramentas e Sistemas", descricao: "Domínio das ferramentas do trabalho.", pergunta: "Em quais ferramentas você sente que perde mais tempo ou tem dúvidas?", focoPdi: "Dominar as ferramentas e sistemas da função" },
  { chave: "priorizacao", campo: "pPriorizacao", nome: "Capacidade de Priorização", descricao: "Foco no que gera mais impacto.", pergunta: "Como você decide o que fazer primeiro quando tudo parece urgente?", focoPdi: "Priorizar demandas pelo impacto" },
  { chave: "tempo", campo: "pTempo", nome: "Gestão do Tempo", descricao: "Prazos e organização da agenda.", pergunta: "Quais prazos foram mais difíceis de cumprir recentemente e por quê?", focoPdi: "Organizar a agenda e cumprir prazos" },
  { chave: "aprendizado", campo: "pAprendizado", nome: "Estudo e Aprendizado", descricao: "Busca ativa por desenvolvimento.", pergunta: "O que você gostaria de aprender nos próximos meses e como posso ajudar?", focoPdi: "Criar rotina de estudo e aprendizado" },
  { chave: "relacionamento", campo: "pRelacionamento", nome: "Relacionamento", descricao: "Interação com time, pares e áreas.", pergunta: "Com quem você sente mais dificuldade de trabalhar junto? O que poderia mudar?", focoPdi: "Fortalecer o relacionamento com time e áreas parceiras" },
  { chave: "comunicacao", campo: "pComunicacao", nome: "Comunicação", descricao: "Clareza e momento certo de comunicar.", pergunta: "Em que situações você sente que sua mensagem não chegou como gostaria?", focoPdi: "Comunicar com mais clareza e no momento certo" },
];

export const CRITERIOS_CULTURA: Criterio[] = [
  { chave: "criatividade", campo: "cCriatividade", nome: "Criatividade", descricao: "Novas ideias e soluções.", pergunta: "Que ideia você gostaria de testar e ainda não teve espaço?", focoPdi: "Propor e testar novas soluções" },
  { chave: "confianca", campo: "cConfianca", nome: "Confiança", descricao: "Transparência e cumprimento de acordos.", pergunta: "O que fortaleceria a confiança entre você e o time?", focoPdi: "Fortalecer a confiança com transparência e acordos cumpridos" },
  { chave: "resultado", campo: "cResultado", nome: "Compromisso com o Resultado", descricao: "Foco no objetivo final.", pergunta: "Qual resultado do trimestre você considera mais importante e como está contribuindo?", focoPdi: "Conectar as entregas aos resultados esperados" },
  { chave: "sensoDono", campo: "cSensoDono", nome: "Senso de Dono", descricao: "Responsabilidade além do escopo.", pergunta: "Em que situação recente você poderia ter assumido a frente e não assumiu?", focoPdi: "Assumir responsabilidade de ponta a ponta" },
  { chave: "adaptabilidade", campo: "cAdaptabilidade", nome: "Adaptabilidade", descricao: "Lidar bem com mudanças.", pergunta: "Qual mudança recente foi mais difícil para você? O que ajudaria?", focoPdi: "Lidar melhor com mudanças de contexto" },
  { chave: "resiliencia", campo: "cResiliencia", nome: "Resiliência", descricao: "Seguir em frente diante de obstáculos.", pergunta: "Como você tem lidado com os obstáculos do trabalho? Que apoio faltou?", focoPdi: "Desenvolver resiliência diante de obstáculos" },
  { chave: "longoPrazo", campo: "cLongoPrazo", nome: "Visão de Longo Prazo", descricao: "Decisões que consideram o futuro.", pergunta: "Onde você quer estar em um ano e o que precisa acontecer até lá?", focoPdi: "Considerar o longo prazo nas decisões" },
  { chave: "colaboracao", campo: "cColaboracao", nome: "Colaboração", descricao: "Ajudar e somar com o time.", pergunta: "Em que momento você poderia ter pedido ou oferecido ajuda?", focoPdi: "Colaborar mais ativamente com o time" },
];

export const TODOS_CRITERIOS = [...CRITERIOS_PERFORMANCE, ...CRITERIOS_CULTURA];

export const ESCALA: Record<number, string> = {
  1: "Muito abaixo das expectativas",
  2: "Abaixo das expectativas",
  3: "Atende às expectativas",
  4: "Acima das expectativas",
  5: "Supera consistentemente",
};

export type Notas = Partial<Record<string, number>>;
export type SemaforoCor = "verde" | "amarelo" | "vermelho";

export const SEMAFORO: Record<SemaforoCor, { nome: string; tom: "sucesso" | "alerta" | "perigo"; ordem: number }> = {
  vermelho: { nome: "Vermelho · atenção", tom: "perigo", ordem: 0 },
  amarelo: { nome: "Amarelo · acompanhar", tom: "alerta", ordem: 1 },
  verde: { nome: "Verde · bom", tom: "sucesso", ordem: 2 },
};

export function semaforoDe(geral: number): SemaforoCor {
  if (geral >= 4) return "verde";
  if (geral >= 3) return "amarelo";
  return "vermelho";
}

const media = (lista: Criterio[], notas: Notas) => lista.reduce((s, c) => s + (notas[c.campo] ?? 0), 0) / lista.length;
const notaValida = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;

/** Médias e semáforo — null enquanto faltar alguma das 16 notas (não há média final parcial). */
export function calcularMedias(notas: Notas) {
  const faltando = TODOS_CRITERIOS.filter((c) => !notaValida(notas[c.campo])).length;
  if (faltando) return { completo: false as const, faltando };
  const performance = media(CRITERIOS_PERFORMANCE, notas);
  const cultura = media(CRITERIOS_CULTURA, notas);
  const geral = (performance + cultura) / 2;
  return { completo: true as const, performance, cultura, geral, semaforo: semaforoDe(geral) };
}

/** Parciais por dimensão (para a prévia): só quando os 8 critérios da dimensão estão preenchidos. */
export function mediaDimensao(lista: Criterio[], notas: Notas) {
  return lista.every((c) => notaValida(notas[c.campo])) ? media(lista, notas) : null;
}

/** Apresentação com uma casa decimal (vírgula). */
export const umaCasa = (n: number | string | { toString(): string }) => Number(n.toString()).toFixed(1).replace(".", ",");

/** Critérios com as menores notas (para perguntas sugeridas). */
export function criteriosMaisBaixos(notas: Notas, limite = 3) {
  return TODOS_CRITERIOS.filter((c) => notaValida(notas[c.campo]))
    .sort((a, b) => (notas[a.campo] ?? 0) - (notas[b.campo] ?? 0))
    .filter((c) => (notas[c.campo] ?? 5) <= 3)
    .slice(0, limite);
}

/** Notas de um registro de avaliação (colunas p_*, c_*) no formato { campo: nota }. */
export const notasDe = (a: object) => Object.fromEntries(TODOS_CRITERIOS.map((c) => [c.campo, (a as Record<string, number>)[c.campo]])) as Notas;

// ─── Cadência ─────────────────────────────────────────────────────────────

export type PeriodicidadeFeedback = "mensal" | "bimestral" | "trimestral" | "manual";
export const PERIODICIDADE: Record<PeriodicidadeFeedback, { nome: string; dias: number | null }> = {
  mensal: { nome: "Mensal (30 dias)", dias: 30 },
  bimestral: { nome: "Bimestral (60 dias)", dias: 60 },
  trimestral: { nome: "Trimestral (90 dias)", dias: 90 },
  manual: { nome: "Manual (sem lembrete)", dias: null },
};
/** Cadência inicial sugerida quando a pessoa ainda não tem feedback. */
export const CADENCIA_INICIAL_DIAS = 30;

export type Cadencia =
  | { estado: "sem_referencia" | "manual"; proxima: null; dias: null; base: "ultimo" | "admissao" | null }
  | { estado: "atrasado" | "proximo" | "em_dia"; proxima: Date; dias: number; base: "ultimo" | "admissao" };

/**
 * Próxima data recomendada: último feedback + periodicidade dele; sem histórico,
 * data de entrada + 30 dias. Sem nenhuma das duas, não inventa data.
 * "Próximo" até 7 dias antes; "atrasado" depois da data prevista.
 */
export function cadencia(ultimo: { data: Date; periodicidade: PeriodicidadeFeedback } | null, dataAdmissao: Date | null, hoje: Date): Cadencia {
  let proxima: Date;
  let base: "ultimo" | "admissao";
  if (ultimo) {
    const dias = PERIODICIDADE[ultimo.periodicidade].dias;
    if (dias === null) return { estado: "manual", proxima: null, dias: null, base: "ultimo" };
    proxima = somarDias(ultimo.data, dias);
    base = "ultimo";
  } else if (dataAdmissao) {
    proxima = somarDias(dataAdmissao, CADENCIA_INICIAL_DIAS);
    base = "admissao";
  } else {
    return { estado: "sem_referencia", proxima: null, dias: null, base: null };
  }
  const dias = diasEntre(hoje, proxima);
  return { estado: dias < 0 ? "atrasado" : dias <= 7 ? "proximo" : "em_dia", proxima, dias, base };
}

export const ESTADO_CADENCIA = {
  atrasado: { nome: "Atrasado", tom: "perigo" },
  proximo: { nome: "Próximo", tom: "alerta" },
  em_dia: { nome: "Em dia", tom: "sucesso" },
  manual: { nome: "Manual", tom: "neutro" },
  sem_referencia: { nome: "Sem referência", tom: "neutro" },
} as const;

// ─── Agenda ───────────────────────────────────────────────────────────────

export const DURACOES = [15, 30, 45, 60, 90] as const;
/** 08:00 a 18:00, de 30 em 30 minutos. */
export const HORARIOS = Array.from({ length: 21 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
export const RECORRENCIA = { nenhuma: "Não se repete", mensal: "Mensal (+3 ocorrências)", trimestral: "Trimestral (+3 ocorrências)" } as const;
