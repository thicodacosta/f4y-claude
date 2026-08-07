/**
 * Import único do "RELATÓRIO DETALHADO DE VAGAS - F4Y" (07/08/2026, PDF
 * fornecido pelo usuário) para o banco real. Roda uma vez via `npx tsx
 * scripts/import-relatorio-vagas.ts`, não faz parte do app em runtime.
 *
 * Premissas assumidas (documentadas para o usuário revisar depois):
 * - Vaga.valor = "Salário" informado no relatório (não é necessariamente o
 *   valor faturado ao cliente — é o único número disponível na fonte).
 * - Vaga.fechadoEm para vagas fechadas = dia 15 do mês em que o relatório
 *   classifica o fechamento (não a "Data de Início", que muitas vezes cai no
 *   mês seguinte e distorceria os agregados mensais do Dashboard).
 * - Vertical é uma classificação automática por tipo de cargo/contrato —
 *   pedido explícito do usuário foi ajustar manualmente depois.
 * - "Thi" -> tcosta@find4you.info, "Mah" -> mcruz@find4you.info (únicos
 *   usuários internos existentes); outras iniciais do relatório (Lau, Le,
 *   Lê, Lore, Wal) não têm conta no sistema, ficam sem responsável.
 * - Duas vagas fechadas em Jan/2026 sem nome de empresa nem referência de PO
 *   no relatório original ("Desenvolvedor Fullstack .NET+React" e
 *   "Especialista de Recrutamento e Seleção") foram DELIBERADAMENTE
 *   ignoradas — sem empresa não há como cadastrar corretamente.
 */
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Vertical = "tecnologia" | "corporativo" | "executive_search" | "alocacao_tech";
type EtapaNome = "Abertas" | "Análise RH" | "CV Enviado" | "Entrevista Cliente" | "Forecast" | "Fechada";
type EtapaCandidato =
  | "abertas"
  | "analise_rh"
  | "cv_enviado"
  | "entrevista_cliente"
  | "forecast"
  | "fechada";

type CandidatoNota = {
  nome: string;
  etapa: EtapaCandidato;
  nota: string;
  recrutador?: "thi" | "mah";
};

type VagaEntry = {
  empresa: string;
  cargo: string;
  vertical: Vertical;
  salario?: number;
  localizacao?: string;
  gestorNome?: string;
  confidencial?: boolean;
  etapa: EtapaNome;
  candidatos?: CandidatoNota[];
  fechadaMes?: string; // "2026-01"
  candidatoFechado?: string;
  observacao?: string;
};

function parseLocal(loc?: string): { modeloTrabalho?: "remoto" | "hibrido" | "presencial"; cidade?: string } {
  if (!loc) return {};
  const l = loc.toLowerCase();
  const modeloTrabalho = l.includes("híbrido") || l.includes("hibrido")
    ? "hibrido"
    : l.includes("presencial")
      ? "presencial"
      : l.includes("remoto")
        ? "remoto"
        : undefined;
  return { modeloTrabalho };
}

// ---------------------------------------------------------------------------
// VAGAS ABERTAS
// ---------------------------------------------------------------------------
const abertas: VagaEntry[] = [
  { empresa: "TOTVS", cargo: "Desenvolvedor Fullstack Pleno 2", vertical: "tecnologia", salario: 4000, localizacao: "Híbrido SP ou 100% remoto (base TOTVS)", gestorNome: "Cleber Stenio", etapa: "Abertas" },
  { empresa: "TOTVS", cargo: "Desenvolvedor BackEnd Sênior Node", vertical: "tecnologia", salario: 4000, localizacao: "Híbrido SP ou 100% remoto (base TOTVS)", gestorNome: "Cleber Stenio", etapa: "Abertas" },
  { empresa: "TOTVS", cargo: "Desenvolvedor BackEnd 2 Sênior Node", vertical: "tecnologia", salario: 4000, localizacao: "Híbrido SP ou 100% remoto (base TOTVS)", gestorNome: "Cleber Stenio", etapa: "Abertas" },
  { empresa: "TOTVS", cargo: "Desenvolvedor BackEnd Pleno Node", vertical: "tecnologia", salario: 4000, localizacao: "Híbrido SP ou 100% remoto (base TOTVS)", gestorNome: "Cleber Stenio", etapa: "Abertas" },
  { empresa: "TOTVS", cargo: "Desenvolvedor Fullstack Pleno 3", vertical: "tecnologia", salario: 4000, localizacao: "Híbrido SP ou 100% remoto (base TOTVS)", gestorNome: "Cleber Stenio", etapa: "Abertas" },
  {
    empresa: "TOTVS", cargo: "Desenvolvedor Fullstack Pleno", vertical: "tecnologia", salario: 4000,
    localizacao: "Híbrido SP ou 100% remoto (base TOTVS)", gestorNome: "Cleber Stenio", etapa: "Abertas",
    candidatos: [
      { nome: "Valdir Silva", etapa: "entrevista_cliente", nota: "Entrevista 03/07", recrutador: "thi" },
      { nome: "Luiz Araujo", etapa: "cv_enviado", nota: "Enviado 03/07, teste OK", recrutador: "thi" },
    ],
  },
  { empresa: "BTA", cargo: "Analista de Compras", vertical: "corporativo", salario: 8073.60, localizacao: "Presencial Jaraguá", etapa: "Abertas" },
  { empresa: "Pestana", cargo: "Analista de dados IA", vertical: "tecnologia", salario: 19720, localizacao: "Híbrido POA", etapa: "Abertas" },
  { empresa: "ZPE Systems", cargo: "Engenheiro de Software", vertical: "tecnologia", localizacao: "Híbrido Blumenau", etapa: "Abertas" },
  { empresa: "ZPE Systems", cargo: "Engenheiro de Software SR", vertical: "tecnologia", localizacao: "Híbrido Blumenau", etapa: "Abertas" },
  { empresa: "ZPE Systems", cargo: "Engenheiro de Software PL", vertical: "tecnologia", localizacao: "Híbrido Blumenau", etapa: "Abertas" },
  { empresa: "WAP", cargo: "Líder R&S", vertical: "corporativo", localizacao: "Presencial SJP", etapa: "Abertas" },
];

// ---------------------------------------------------------------------------
// ANÁLISE RH / TESTES
// ---------------------------------------------------------------------------
const analiseRh: VagaEntry[] = [
  {
    empresa: "Vinde", cargo: "Engenheiro de Software SR", vertical: "tecnologia", localizacao: "Criciúma", etapa: "Análise RH",
    candidatos: [
      { nome: "Matheus Benedet", etapa: "analise_rh", nota: "Avaliando", recrutador: "mah" },
      { nome: "Fabiano Elias Junior", etapa: "analise_rh", nota: "Avaliando", recrutador: "mah" },
    ],
  },
];

// ---------------------------------------------------------------------------
// ENTREVISTA CLIENTE
// ---------------------------------------------------------------------------
const entrevistaCliente: VagaEntry[] = [
  {
    empresa: "BTA", cargo: "Diretor de P&D", vertical: "executive_search", salario: 31320, localizacao: "Presencial Xanxerê", etapa: "Entrevista Cliente",
    candidatos: [
      { nome: "Diego de Souza", etapa: "entrevista_cliente", nota: "ITW 31/07" },
      { nome: "João Rossetto", etapa: "entrevista_cliente", nota: "ITW 04/08 às 11h" },
    ],
  },
  {
    empresa: "WAP", cargo: "Coordenador COMEX", vertical: "executive_search", confidencial: true, salario: 13920, localizacao: "Presencial SJP", etapa: "Entrevista Cliente",
    observacao: "Vaga confidencial (Coordenador COMEX) — PJ.",
    candidatos: [
      { nome: "Leandro Gurek", etapa: "entrevista_cliente", nota: "ITW 06/08 às 11h", recrutador: "thi" },
      { nome: "Leonardo Bublitz", etapa: "entrevista_cliente", nota: "Entrevista a confirmar", recrutador: "thi" },
      { nome: "Jean Carlo", etapa: "cv_enviado", nota: "Enviado ao cliente 05/08", recrutador: "thi" },
    ],
  },
  {
    empresa: "ZPE Systems", cargo: "Engenheiro de Hardware Junior", vertical: "tecnologia", salario: 9280, localizacao: "Presencial Blumenau", etapa: "Entrevista Cliente",
    candidatos: [
      { nome: "Diogo Mazeika", etapa: "analise_rh", nota: "Avaliando", recrutador: "mah" },
      { nome: "Lucas Albert Gommersbach", etapa: "entrevista_cliente", nota: "Entrevista 19/08 às 14:00", recrutador: "mah" },
      { nome: "Diones Morais", etapa: "analise_rh", nota: "Avaliando", recrutador: "mah" },
      { nome: "Adrian Gazzani", etapa: "analise_rh", nota: "Avaliando", recrutador: "mah" },
    ],
  },
];

// ---------------------------------------------------------------------------
// FORECAST
// ---------------------------------------------------------------------------
const forecast: VagaEntry[] = [
  {
    empresa: "BTA", cargo: "Controller SR", vertical: "corporativo", salario: 31320, localizacao: "Presencial Xanxerê", etapa: "Forecast",
    candidatos: [
      { nome: "Francisco Carlota", etapa: "cv_enviado", nota: "Enviado 03/08" },
      { nome: "Carlos Picolo", etapa: "entrevista_cliente", nota: "Entrevista 04/08", recrutador: "thi" },
      { nome: "Fabiana", etapa: "forecast", nota: "Proposta salarial em curso", recrutador: "thi" },
    ],
  },
  {
    empresa: "ZPE Systems", cargo: "Engenheiro de Suporte N3", vertical: "tecnologia", salario: 12760, localizacao: "Presencial Blumenau", etapa: "Forecast",
    candidatos: [{ nome: "Elder Cirilo", etapa: "forecast", nota: "Início a confirmar" }],
  },
  {
    empresa: "TOTVS", cargo: "Desenvolvedor Fullstack JR", vertical: "tecnologia", salario: 4000, localizacao: "Híbrido SP ou 100% remoto (base TOTVS)", gestorNome: "Cleber Stenio", etapa: "Forecast",
    candidatos: [{ nome: "Cristian Ceccon", etapa: "entrevista_cliente", nota: "Entrevista 28/07 às 9:00", recrutador: "thi" }],
  },
  {
    empresa: "WAP", cargo: "Analista de Endomarketing", vertical: "corporativo", salario: 8700, etapa: "Forecast",
    candidatos: [{ nome: "Eloisa Hein", etapa: "cv_enviado", nota: "Enviado ao cliente 23/07", recrutador: "thi" }],
  },
];

// ---------------------------------------------------------------------------
// FECHADAS (por mês)
// ---------------------------------------------------------------------------
const fechadas: VagaEntry[] = [
  // Janeiro 2026
  { empresa: "Carfinder", cargo: "Desenvolvedor Full Stack (PHP + Angular) SR", vertical: "alocacao_tech", localizacao: "Remoto ou Híbrido POA", gestorNome: "James", etapa: "Fechada", fechadaMes: "2026-01", candidatoFechado: "Artom Jakobowski", observacao: "Cooperado." },
  { empresa: "Concentrix", cargo: "Engenheiro de Dados SR", vertical: "tecnologia", localizacao: "Remoto CWB ou SP", gestorNome: "Marcos", etapa: "Fechada", fechadaMes: "2026-01", candidatoFechado: "Kaique Pedronio Novi", observacao: "CLT. Requer inglês avançado." },
  { empresa: "Concentrix", cargo: "Software Engineer SR", vertical: "tecnologia", localizacao: "Remoto (base CWB ou SP)", gestorNome: "Marcos", etapa: "Fechada", fechadaMes: "2026-01", candidatoFechado: "Juliano Miquelleto", observacao: "CLT." },
  { empresa: "Concentrix", cargo: "Engenheiro de Dados PL", vertical: "tecnologia", localizacao: "Remoto CWB ou SP", gestorNome: "Marcos", etapa: "Fechada", fechadaMes: "2026-01", candidatoFechado: "Lucas Urbanski", observacao: "CLT. Requer inglês avançado." },
  { empresa: "Concentrix", cargo: "Analyst JR CRM", vertical: "corporativo", localizacao: "Remoto com idas esporádicas a CWB", gestorNome: "Emanuel", etapa: "Fechada", fechadaMes: "2026-01", candidatoFechado: "Kauã Silveira", observacao: "CLT. PO-WBR05-260000109." },
  { empresa: "Concentrix", cargo: "Analyst JR CRM", vertical: "corporativo", localizacao: "Remoto com idas esporádicas a CWB", gestorNome: "Vilmar", etapa: "Fechada", fechadaMes: "2026-01", candidatoFechado: "Lorena Miriane Bregoch", observacao: "CLT. Inglês intermediário. PO-WBR05-260000109." },
  { empresa: "Concentrix", cargo: "Software Engineer Full Stack JR", vertical: "tecnologia", localizacao: "Remoto CWB ou SP", gestorNome: "Jeferson", etapa: "Fechada", fechadaMes: "2026-01", candidatoFechado: "Leonardo do Amaral", observacao: "CLT. Inglês avançado. Empresa inferida via PO-WBR05-26000037 (não citada por nome no relatório original)." },
  { empresa: "Concentrix", cargo: "Software Engineer Full Stack JR", vertical: "tecnologia", localizacao: "Remoto CWB ou SP", gestorNome: "Jeferson", etapa: "Fechada", fechadaMes: "2026-01", candidatoFechado: "Gabriel Stenzowski", observacao: "CLT. Empresa inferida via PO-WBR05-26000037 (não citada por nome no relatório original)." },

  // Fevereiro 2026
  { empresa: "R10 Score", cargo: "Secretária Executiva", vertical: "corporativo", localizacao: "Híbrido SP", etapa: "Fechada", fechadaMes: "2026-02", candidatoFechado: "Lais", observacao: "PJ. Inglês avançado." },
  { empresa: "SPEVO", cargo: "Desenvolvedor Mobile PL", vertical: "tecnologia", etapa: "Fechada", fechadaMes: "2026-02", candidatoFechado: "Caio Zubek" },
  { empresa: "Belinati Perez", cargo: "Analista de Telecom Sr", vertical: "corporativo", localizacao: "Híbrido CWB", etapa: "Fechada", fechadaMes: "2026-02", candidatoFechado: "Andrey Liz Moreira", observacao: "PJ." },

  // Março 2026
  { empresa: "WAP", cargo: "Especialista em Logística", vertical: "corporativo", localizacao: "Presencial SJP", etapa: "Fechada", fechadaMes: "2026-03", candidatoFechado: "Leonardo Glodzienski", observacao: "PJ." },
  { empresa: "R10 Score", cargo: "Gerente Financeiro", vertical: "corporativo", localizacao: "Presencial SP", etapa: "Fechada", fechadaMes: "2026-03", candidatoFechado: "Amauri Souza", observacao: "PJ." },
  { empresa: "2F1", cargo: "Analista Contábil", vertical: "corporativo", localizacao: "Remoto", etapa: "Fechada", fechadaMes: "2026-03", candidatoFechado: "Giovanna Carla", observacao: "CLT." },
  { empresa: "2F1", cargo: "Analista Contábil", vertical: "corporativo", localizacao: "Remoto", etapa: "Fechada", fechadaMes: "2026-03", candidatoFechado: "Aline Valdevino da Silva", observacao: "CLT." },
  { empresa: "2F1", cargo: "Analista Contábil", vertical: "corporativo", localizacao: "Remoto", etapa: "Fechada", fechadaMes: "2026-03", candidatoFechado: "Jessey Moreira Souza", observacao: "CLT." },

  // Abril 2026
  { empresa: "WAP", cargo: "Secretária Executiva", vertical: "corporativo", localizacao: "Presencial SJP", gestorNome: "Bruna", etapa: "Fechada", fechadaMes: "2026-04", candidatoFechado: "Luana Gimenez", observacao: "PJ. Inglês avançado." },
  { empresa: "Pestana", cargo: "SAP FICO", vertical: "alocacao_tech", localizacao: "Presencial POA", gestorNome: "James", etapa: "Fechada", fechadaMes: "2026-04", candidatoFechado: "Carlos Menezes", observacao: "Cooperado." },

  // Maio 2026
  { empresa: "BTA", cargo: "Gerente de Tecnologia", vertical: "tecnologia", localizacao: "Xanxerê ou Jaraguá do Sul", etapa: "Fechada", fechadaMes: "2026-05", candidatoFechado: "Vinicius Stanke", observacao: "PJ." },
  { empresa: "ZPE Systems", cargo: "QA", vertical: "tecnologia", localizacao: "Presencial Blumenau", etapa: "Fechada", fechadaMes: "2026-05", candidatoFechado: "Guilherme Sanches" },
  { empresa: "TOTVS", cargo: "Especialista IA", vertical: "tecnologia", localizacao: "Híbrido SP (1x presencial) ou 100% remoto (base TOTVS)", etapa: "Fechada", fechadaMes: "2026-05", candidatoFechado: "Vitor Vaz" },
  { empresa: "Pestana", cargo: "Desenvolvedor Fullstack .NET + React", vertical: "alocacao_tech", localizacao: "Presencial POA", etapa: "Fechada", fechadaMes: "2026-05", candidatoFechado: "Christian Lima", observacao: "Cooperado." },
  { empresa: "ZPE Systems", cargo: "Engenheiro de Suporte N3", vertical: "tecnologia", localizacao: "Presencial Blumenau", etapa: "Fechada", fechadaMes: "2026-05", candidatoFechado: "Renan G. Leithold", observacao: "CLT. Inglês avançado e espanhol básico/intermediário." },

  // Junho 2026
  { empresa: "TOTVS", cargo: "Desenvolvedor Fullstack JR", vertical: "tecnologia", localizacao: "Híbrido SP ou 100% remoto (base TOTVS)", gestorNome: "Cleber Stenio", etapa: "Fechada", fechadaMes: "2026-06", candidatoFechado: "Rebeca dos Reis" },
  { empresa: "Obramax", cargo: "Tech Lead Vtex", vertical: "tecnologia", localizacao: "Híbrido Liberdade SP", etapa: "Fechada", fechadaMes: "2026-06", candidatoFechado: "Wandreus Pereira" },
  { empresa: "R10 Score", cargo: "Executivo Comercial Senior", vertical: "corporativo", localizacao: "Remoto", etapa: "Fechada", fechadaMes: "2026-06", candidatoFechado: "Amanda Kurahayashi", observacao: "Registrada como 'R10 Score / OTG' no relatório original." },

  // Julho 2026
  { empresa: "WAP", cargo: "Analista de Recrutamento Senior", vertical: "corporativo", localizacao: "Presencial SJP", etapa: "Fechada", fechadaMes: "2026-07", candidatoFechado: "Amanda" },
  { empresa: "BTA", cargo: "CFO", vertical: "executive_search", localizacao: "Presencial Jaraguá", etapa: "Fechada", fechadaMes: "2026-07", candidatoFechado: "Rodrigo Vianney de Lima", observacao: "Chief Financial Officer." },
];

const todasVagas = [...abertas, ...analiseRh, ...entrevistaCliente, ...forecast, ...fechadas];

async function main() {
  console.log(`Importando ${todasVagas.length} vagas...`);

  const usuarios = await prisma.usuario.findMany({ where: { nome: { in: ["tcosta", "mcruz"] } } });
  const thiId = usuarios.find((u) => u.nome === "tcosta")?.id ?? null;
  const mahId = usuarios.find((u) => u.nome === "mcruz")?.id ?? null;

  const pipeline = await prisma.pipeline.findUniqueOrThrow({ where: { tipo: "vagas" }, include: { etapas: true } });
  const etapaPorNome = new Map(pipeline.etapas.map((e) => [e.nome, e]));

  const regras = await prisma.regraComissao.findMany();
  const regraPorVertical = new Map(regras.map((r) => [r.vertical, r]));

  const empresaCache = new Map<string, string>();
  async function getEmpresaId(nome: string) {
    if (empresaCache.has(nome)) return empresaCache.get(nome)!;
    const existente = await prisma.empresa.findFirst({ where: { nome: { equals: nome, mode: "insensitive" } } });
    const empresa = existente ?? (await prisma.empresa.create({ data: { nome, status: "ativo", origem: "Relatório de vagas (importação)" } }));
    empresaCache.set(nome, empresa.id);
    return empresa.id;
  }

  const candidatoCache = new Map<string, string>();
  async function getCandidatoId(nome: string) {
    const chave = nome.trim().toLowerCase();
    if (candidatoCache.has(chave)) return candidatoCache.get(chave)!;
    const candidato = await prisma.candidato.create({ data: { nome: nome.trim() } });
    candidatoCache.set(chave, candidato.id);
    return candidato.id;
  }

  let criadas = 0;
  for (const v of todasVagas) {
    const empresaId = await getEmpresaId(v.empresa);
    const etapa = etapaPorNome.get(v.etapa);
    if (!etapa) throw new Error(`Etapa "${v.etapa}" não encontrada no Pipeline de Vagas.`);
    const { modeloTrabalho } = parseLocal(v.localizacao);
    const isFechada = v.etapa === "Fechada";
    const fechadoEm = v.fechadaMes ? new Date(`${v.fechadaMes}-15T12:00:00Z`) : null;

    const recrutadorPrincipal =
      v.candidatos?.find((c) => c.recrutador)?.recrutador === "mah" ? mahId
      : v.candidatos?.some((c) => c.recrutador === "thi") ? thiId
      : null;

    const vaga = await prisma.vaga.create({
      data: {
        empresaId,
        etapaId: etapa.id,
        cargo: v.cargo,
        vertical: v.vertical,
        gestorNome: v.gestorNome,
        salarioMin: v.salario,
        salarioMax: v.salario,
        valor: v.salario ?? null,
        modeloTrabalho,
        confidencial: !!v.confidencial,
        status: isFechada ? "fechada" : "aberta",
        fechadoEm,
        recrutadorId: recrutadorPrincipal,
      },
    });
    criadas++;

    if (v.observacao) {
      await prisma.atividade.create({
        data: { entidadeTipo: "vaga", entidadeId: vaga.id, tipo: "nota", conteudo: v.observacao },
      });
    }

    if (v.candidatoFechado) {
      const candidatoId = await getCandidatoId(v.candidatoFechado);
      await prisma.vagaCandidato.create({ data: { vagaId: vaga.id, candidatoId, etapa: "fechada" } });
    }

    for (const c of v.candidatos ?? []) {
      const candidatoId = await getCandidatoId(c.nome);
      await prisma.vagaCandidato.create({ data: { vagaId: vaga.id, candidatoId, etapa: c.etapa } });
      await prisma.atividade.create({
        data: { entidadeTipo: "vaga", entidadeId: vaga.id, tipo: "nota", conteudo: `${c.nome}: ${c.nota}` },
      });
    }

    // Réplica exata da lógica de modules/financeiro/comissoes.ts#gerarFaturamentoEComissao
    // (não importada diretamente por causa do guard "server-only").
    if (isFechada && v.salario && v.salario > 0) {
      await prisma.faturamento.create({
        data: { empresaId, origemTipo: "vaga", origemId: vaga.id, valor: v.salario, dataPrevista: fechadoEm },
      });
      const regra = regraPorVertical.get(v.vertical);
      if (recrutadorPrincipal && regra?.percentualRecrutador) {
        const competencia = v.fechadaMes!;
        await prisma.comissao.create({
          data: {
            usuarioId: recrutadorPrincipal,
            origemTipo: "vaga",
            origemId: vaga.id,
            valor: (v.salario * Number(regra.percentualRecrutador)) / 100,
            percentual: regra.percentualRecrutador,
            competencia,
          },
        });
      }
    }
  }

  console.log(`OK — ${criadas} vagas criadas, ${empresaCache.size} empresas, ${candidatoCache.size} candidatos.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
