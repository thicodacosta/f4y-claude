import { z } from "zod";
import { CHAVES_MOTIVO, type Motivo } from "./motivos";

/**
 * Entrevista de desligamento — questionário fixo (comparável entre pessoas e ao
 * longo do tempo). Pura: usada pelo formulário (público e interno), pela
 * validação no servidor e pelos indicadores.
 */

/** Experiência na empresa, de 1 (muito insatisfeito) a 5 (muito satisfeito). */
export const DIMENSOES = {
  lideranca: "Relação com a liderança direta",
  reconhecimento: "Reconhecimento pelo trabalho",
  remuneracao: "Remuneração e benefícios",
  crescimento: "Oportunidades de crescimento",
  carga: "Carga de trabalho e equilíbrio",
  ambiente: "Ambiente e relação com colegas",
  clareza: "Clareza do papel e das expectativas",
  cultura: "Cultura e valores da empresa",
  recursos: "Ferramentas e recursos para trabalhar",
  integracao: "Integração (onboarding) ao chegar",
} as const;
export type Dimensao = keyof typeof DIMENSOES;
export const CHAVES_DIMENSAO = Object.keys(DIMENSOES) as Dimensao[];

export const ESCALA = ["Muito insatisfeito", "Insatisfeito", "Neutro", "Satisfeito", "Muito satisfeito"] as const;

export const DESTINOS = {
  mesmo_setor: "Outra empresa do mesmo setor",
  outro_setor: "Empresa de outro setor",
  empreender: "Empreender ou trabalhar por conta própria",
  estudos: "Estudos",
  pausa: "Pausa na carreira",
  ainda_nao_sei: "Ainda não sei",
  prefiro_nao_dizer: "Prefiro não dizer",
} as const;

export const SIM_TALVEZ_NAO = { sim: "Sim", talvez: "Talvez", nao: "Não" } as const;

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((v) => v || null);

export const respostasSchema = z
  .object({
    motivos: z.array(z.enum(CHAVES_MOTIVO as [Motivo, ...Motivo[]]), { message: "Escolha ao menos um motivo da saída." }).min(1, "Escolha ao menos um motivo da saída.").max(5, "Escolha até 5 motivos."),
    motivoPrincipal: z.enum(CHAVES_MOTIVO as [Motivo, ...Motivo[]], { message: "Indique o principal motivo." }),
    decisao: texto(3000),
    experiencia: z.partialRecord(z.enum(CHAVES_DIMENSAO as [Dimensao, ...Dimensao[]]), z.number().int().min(1).max(5), { message: "Avalie todos os itens da experiência na empresa." }),
    evitavel: z.enum(["sim", "talvez", "nao"], { message: "Responda se algo poderia ter evitado a saída." }),
    oQueEvitaria: texto(2000),
    enps: z.number({ message: "Escolha uma nota de 0 a 10 para a recomendação." }).int().min(0).max(10, "Escolha uma nota de 0 a 10."),
    voltaria: z.enum(["sim", "talvez", "nao"], { message: "Responda se voltaria a trabalhar na empresa." }),
    destino: z.enum(Object.keys(DESTINOS) as [keyof typeof DESTINOS, ...(keyof typeof DESTINOS)[]]).optional().nullable(),
    sugestoes: texto(3000),
  })
  .superRefine((r, ctx) => {
    if (!r.motivos.includes(r.motivoPrincipal)) ctx.addIssue({ code: "custom", message: "O motivo principal precisa estar entre os motivos marcados.", path: ["motivoPrincipal"] });
    const faltam = CHAVES_DIMENSAO.filter((d) => !(d in r.experiencia));
    if (faltam.length) ctx.addIssue({ code: "custom", message: "Avalie todos os itens da experiência na empresa.", path: ["experiencia"] });
  });

export type RespostasEntrevista = z.infer<typeof respostasSchema>;

/** Respostas gravadas (tolerante a versões antigas): null se o JSON não for válido. */
export function lerRespostas(json: unknown): RespostasEntrevista | null {
  const r = respostasSchema.safeParse(json);
  return r.success ? r.data : null;
}

/** eNPS (–100 a 100) a partir de notas 0–10: % promotores (9–10) − % detratores (0–6). */
export function calcularEnpsNotas(notas: number[]) {
  if (!notas.length) return null;
  const prom = notas.filter((n) => n >= 9).length;
  const det = notas.filter((n) => n <= 6).length;
  return Math.round(((prom - det) / notas.length) * 100);
}
