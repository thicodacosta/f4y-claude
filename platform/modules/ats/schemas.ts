import { z } from "zod";

export const modeloTrabalhoValues = ["remoto", "hibrido", "presencial"] as const;
export const modeloTrabalhoLabel: Record<(typeof modeloTrabalhoValues)[number], string> = {
  remoto: "Remoto",
  hibrido: "Híbrido",
  presencial: "Presencial",
};

export const senioridadeValues = ["junior", "pleno", "senior", "especialista"] as const;
export const senioridadeLabel: Record<(typeof senioridadeValues)[number], string> = {
  junior: "Júnior",
  pleno: "Pleno",
  senior: "Sênior",
  especialista: "Especialista",
};

export const prioridadeVagaValues = ["baixa", "media", "alta", "urgente"] as const;
export const prioridadeVagaLabel: Record<(typeof prioridadeVagaValues)[number], string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const disponibilidadeValues = ["imediata", "quinze_dias", "trinta_dias", "indisponivel"] as const;
export const disponibilidadeLabel: Record<(typeof disponibilidadeValues)[number], string> = {
  imediata: "Imediata",
  quinze_dias: "15 dias",
  trinta_dias: "30 dias",
  indisponivel: "Indisponível",
};

export const statusCandidatoValues = ["ativo", "em_processo", "alocado", "inativo"] as const;
export const statusCandidatoLabel: Record<(typeof statusCandidatoValues)[number], string> = {
  ativo: "Ativo",
  em_processo: "Em processo",
  alocado: "Alocado",
  inativo: "Inativo",
};

export const etapaVagaCandidatoValues = [
  "abertas",
  "analise_rh",
  "cv_enviado",
  "entrevista_cliente",
  "forecast",
  "fechada",
  "perdida",
] as const;
export const etapaVagaCandidatoLabel: Record<(typeof etapaVagaCandidatoValues)[number], string> = {
  abertas: "Abertas",
  analise_rh: "Análise RH",
  cv_enviado: "CV Enviado",
  entrevista_cliente: "Entrevista Cliente",
  forecast: "Forecast",
  fechada: "Fechada",
  perdida: "Perdida",
};

/** Mesmas cores do seed do Pipeline de Vagas (prisma/seed.sql) — aqui as
 * etapas são um enum fixo (não uma tabela configurável), então a cor vive no
 * código em vez do banco. */
export const etapaVagaCandidatoCor: Record<(typeof etapaVagaCandidatoValues)[number], string> = {
  abertas: "#9297A0",
  analise_rh: "#28AAF0",
  cv_enviado: "#28AAF0",
  entrevista_cliente: "#5860A9",
  forecast: "#F5A623",
  fechada: "#15A66B",
  perdida: "#E5484D",
};

/** Não usa `.transform()` no schema de propósito: mudaria o tipo do campo
 * entre input (string, o que `useForm` precisa) e output (string[]), o que
 * quebra a inferência do `zodResolver` (Resolver<Input> vs Resolver<Output>
 * deixam de bater). Conversão para array fica na Server Action, depois do
 * `.parse()`. */
export function csvToArray(v: string | undefined) {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const criarVagaSchema = z
  .object({
    empresaId: z.string().uuid().optional(),
    empresaNovaNome: z.string().trim().min(1).optional(),
    cargo: z.string().trim().min(1, "Informe o cargo"),
    vertical: z.enum(["tecnologia", "corporativo", "alocacao_tech"]),
    executiveSearch: z.boolean().optional().default(false),
    quantidadePosicoes: z.coerce.number().int().min(1).default(1),
    prioridade: z.enum(prioridadeVagaValues).default("media"),
    modeloTrabalho: z.enum(modeloTrabalhoValues).optional(),
    senioridade: z.enum(senioridadeValues).optional(),
    cidade: z.string().trim().optional(),
    estado: z.string().trim().optional(),
    salarioMin: z.coerce.number().min(0).optional(),
    salarioMax: z.coerce.number().min(0).optional(),
    stackTecnologica: z.string().trim().optional(),
    jobDescription: z.string().trim().optional(),
    confidencial: z.boolean().optional().default(false),
    oportunidadeOrigemId: z.string().uuid().optional(),
  })
  .refine((data) => data.empresaId || data.empresaNovaNome, {
    message: "Selecione uma empresa existente ou informe o nome de uma nova.",
    path: ["empresaNovaNome"],
  });

export type CriarVagaInput = z.infer<typeof criarVagaSchema>;
export type CriarVagaFormInput = z.input<typeof criarVagaSchema>;

export const moverVagaSchema = z.object({
  vagaId: z.string().uuid(),
  novaEtapaId: z.string().uuid(),
});

export const atualizarVagaSchema = z.object({
  vagaId: z.string().uuid(),
  cargo: z.string().trim().min(1).optional(),
  consultorId: z.string().uuid().nullable().optional(),
  recrutadorId: z.string().uuid().nullable().optional(),
  quantidadePosicoes: z.coerce.number().int().min(1).optional(),
  valor: z.coerce.number().min(0).nullable().optional(),
  prioridade: z.enum(prioridadeVagaValues).optional(),
  modeloTrabalho: z.enum(modeloTrabalhoValues).nullable().optional(),
  senioridade: z.enum(senioridadeValues).nullable().optional(),
  cidade: z.string().trim().nullable().optional(),
  estado: z.string().trim().nullable().optional(),
  salarioMin: z.coerce.number().min(0).nullable().optional(),
  salarioMax: z.coerce.number().min(0).nullable().optional(),
  beneficios: z.string().trim().nullable().optional(),
  stackTecnologica: z.array(z.string()).optional(),
  skillsRequeridas: z.array(z.string()).optional(),
  jobDescription: z.string().trim().nullable().optional(),
  gestorNome: z.string().trim().nullable().optional(),
  gestorContato: z.string().trim().nullable().optional(),
  dataLimite: z.string().nullable().optional(),
  slaDias: z.coerce.number().int().min(0).nullable().optional(),
});

export type AtualizarVagaInput = z.infer<typeof atualizarVagaSchema>;
export type AtualizarVagaFormInput = z.input<typeof atualizarVagaSchema>;

export const criarCandidatoSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome"),
  cargoAtual: z.string().trim().optional(),
  empresaAtual: z.string().trim().optional(),
  cidade: z.string().trim().optional(),
  estado: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
  whatsapp: z.string().trim().optional(),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  linkedin: z.string().trim().optional(),
  github: z.string().trim().optional(),
  portfolioUrl: z.string().trim().optional(),
  skills: z.string().trim().optional(),
  tecnologias: z.string().trim().optional(),
  pretensaoSalarial: z.coerce.number().min(0).optional(),
  disponibilidade: z.enum(disponibilidadeValues).optional(),
  observacoes: z.string().trim().optional(),
});

export type CriarCandidatoInput = z.infer<typeof criarCandidatoSchema>;
export type CriarCandidatoFormInput = z.input<typeof criarCandidatoSchema>;

export const buscaCandidatosSchema = z.object({
  busca: z.string().trim().optional().default(""),
  skill: z.string().trim().optional().default(""),
  cidade: z.string().trim().optional().default(""),
  disponibilidade: z.enum(disponibilidadeValues).optional(),
});

export const adicionarCandidatoVagaSchema = z.object({
  vagaId: z.string().uuid(),
  candidatoId: z.string().uuid(),
  // Fase 8 — preenchido quando o candidato vem de uma sugestão de matching
  // (POST /api/ia/matching), pra já nascer com a trilha de auditoria do
  // fitScore em vez de exigir um segundo cálculo.
  fitScore: z.coerce.number().min(0).max(100).optional(),
  fitScoreJustificativa: z.string().optional(),
  fitScoreModelo: z.string().optional(),
});

export const moverCandidatoVagaSchema = z.object({
  vagaCandidatoId: z.string().uuid(),
  novaEtapa: z.enum(etapaVagaCandidatoValues),
  motivoPerda: z.string().trim().optional(),
});
