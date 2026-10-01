/**
 * Seed de DESENVOLVIMENTO — histórico de turnover da Aurora (dados fictícios):
 * datas de admissão variadas, ex-colaboradores com desligamento e entrevista,
 * ações de retenção e prioridades/prazos no Pipeline de Vagas.
 * Idempotente: não faz nada se a organização já tiver desligamentos registrados.
 *   Sozinho:  npx tsx prisma/seed-turnover.ts   (também ativa Offboarding, Retenção e People Analytics)
 *   Ou dentro de `npm run db:seed`.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { hoje as hojeCivil, somarDias } from "../lib/datas";
import type { Modulo } from "../lib/permissoes";

type Db = PrismaClient;
type Exp = Record<"lideranca" | "reconhecimento" | "remuneracao" | "crescimento" | "carga" | "ambiente" | "clareza" | "cultura" | "recursos" | "integracao", number>;

const exp = (v: number[]): Exp => {
  const k = ["lideranca", "reconhecimento", "remuneracao", "crescimento", "carga", "ambiente", "clareza", "cultura", "recursos", "integracao"] as const;
  return Object.fromEntries(k.map((c, i) => [c, v[i]])) as Exp;
};

type Ex = {
  nome: string;
  email: string;
  cargo: string;
  equipe: string;
  gestor: string | null;
  admissaoDias: number;
  saidaDias: number;
  tipo: "pedido_demissao" | "dispensa_sem_justa_causa" | "acordo" | "termino_contrato";
  declarado: string;
  lamentada?: boolean;
  entrevista?: { motivos: string[]; principal: string; decisao: string; exp: Exp; evitavel: "sim" | "talvez" | "nao"; oQue?: string; enps: number; voltaria: "sim" | "talvez" | "nao"; destino: string; sugestoes?: string };
  pendente?: boolean;
};

const EX: Ex[] = [
  {
    nome: "Henrique Duarte",
    email: "henrique.duarte@aurora.test",
    cargo: "Desenvolvedor Back-end",
    equipe: "Produto",
    gestor: "bruno@aurora.test",
    admissaoDias: -820,
    saidaDias: -350,
    tipo: "pedido_demissao",
    declarado: "proposta",
    lamentada: true,
    entrevista: {
      motivos: ["crescimento", "remuneracao", "proposta"],
      principal: "crescimento",
      decisao: "Fiquei dois anos no mesmo nível sem conversa clara sobre promoção.",
      exp: exp([3, 2, 2, 1, 3, 4, 3, 4, 4, 3]),
      evitavel: "sim",
      oQue: "Um plano de carreira com critérios e prazos.",
      enps: 6,
      voltaria: "talvez",
      destino: "mesmo_setor",
      sugestoes: "Trilhas de carreira para engenharia.",
    },
  },
  {
    nome: "Isadora Lima",
    email: "isadora.lima@aurora.test",
    cargo: "Executiva de Contas",
    equipe: "Comercial",
    gestor: "lucas@aurora.test",
    admissaoDias: -300,
    saidaDias: -260,
    tipo: "pedido_demissao",
    declarado: "pessoal",
    entrevista: {
      motivos: ["lideranca", "cultura"],
      principal: "lideranca",
      decisao: "Metas mudavam toda semana e eu não tinha retorno do gestor.",
      exp: exp([1, 2, 3, 3, 2, 3, 1, 3, 3, 2]),
      evitavel: "sim",
      oQue: "Feedback frequente e metas estáveis no primeiro trimestre.",
      enps: 3,
      voltaria: "nao",
      destino: "mesmo_setor",
    },
  },
  {
    nome: "Joaquim Pereira",
    email: "joaquim.pereira@aurora.test",
    cargo: "SDR",
    equipe: "Comercial",
    gestor: "lucas@aurora.test",
    admissaoDias: -120,
    saidaDias: -60,
    tipo: "pedido_demissao",
    declarado: "remuneracao",
    entrevista: {
      motivos: ["lideranca", "carga", "cultura"],
      principal: "lideranca",
      decisao: "Cheguei sem treinamento e com meta cheia desde a primeira semana.",
      exp: exp([1, 2, 3, 2, 1, 3, 2, 3, 2, 1]),
      evitavel: "sim",
      oQue: "Uma integração de verdade e acompanhamento nas primeiras semanas.",
      enps: 2,
      voltaria: "nao",
      destino: "outro_setor",
    },
  },
  {
    nome: "Larissa Teles",
    email: "larissa.teles@aurora.test",
    cargo: "Designer de Produto",
    equipe: "Produto",
    gestor: "bruno@aurora.test",
    admissaoDias: -1300,
    saidaDias: -150,
    tipo: "pedido_demissao",
    declarado: "flexibilidade",
    lamentada: true,
    entrevista: {
      motivos: ["flexibilidade", "carga"],
      principal: "flexibilidade",
      decisao: "Mudei de cidade e o modelo presencial três vezes por semana ficou inviável.",
      exp: exp([4, 4, 3, 3, 2, 5, 4, 4, 4, 4]),
      evitavel: "talvez",
      oQue: "Uma política de trabalho remoto por função.",
      enps: 8,
      voltaria: "sim",
      destino: "mesmo_setor",
      sugestoes: "Manter os rituais de time — são o melhor da empresa.",
    },
  },
  {
    nome: "Matheus Rocha",
    email: "matheus.rocha@aurora.test",
    cargo: "Analista de Suporte",
    equipe: "Produto",
    gestor: "bruno@aurora.test",
    admissaoDias: -400,
    saidaDias: -200,
    tipo: "dispensa_sem_justa_causa",
    declarado: "desempenho",
  },
  {
    nome: "Natália Freire",
    email: "natalia.freire@aurora.test",
    cargo: "Executiva de Contas",
    equipe: "Comercial",
    gestor: "lucas@aurora.test",
    admissaoDias: -700,
    saidaDias: -95,
    tipo: "pedido_demissao",
    declarado: "proposta",
    entrevista: {
      motivos: ["remuneracao", "reconhecimento", "lideranca"],
      principal: "remuneracao",
      decisao: "A proposta pagava 30% a mais e aqui não havia previsão de revisão.",
      exp: exp([2, 2, 1, 3, 3, 4, 3, 3, 4, 3]),
      evitavel: "talvez",
      oQue: "Revisão salarial anual com critério.",
      enps: 5,
      voltaria: "talvez",
      destino: "mesmo_setor",
    },
  },
  {
    nome: "Otávio Brandão",
    email: "otavio.brandao@aurora.test",
    cargo: "Analista Financeiro",
    equipe: "Pessoas e Cultura",
    gestor: "ana@aurora.test",
    admissaoDias: -1500,
    saidaDias: -30,
    tipo: "acordo",
    declarado: "pessoal",
    entrevista: {
      motivos: ["pessoal", "crescimento"],
      principal: "pessoal",
      decisao: "Vou fazer um mestrado fora do país.",
      exp: exp([5, 4, 4, 3, 4, 5, 4, 5, 4, 4]),
      evitavel: "nao",
      enps: 9,
      voltaria: "sim",
      destino: "estudos",
      sugestoes: "Licença para estudos poderia reter quem quer voltar.",
    },
  },
  { nome: "Paula Siqueira", email: "paula.siqueira@aurora.test", cargo: "QA", equipe: "Produto", gestor: "bruno@aurora.test", admissaoDias: -500, saidaDias: -12, tipo: "pedido_demissao", declarado: "crescimento", pendente: true },
  { nome: "Renato Alves", email: "renato.alves@aurora.test", cargo: "Estagiário Comercial", equipe: "Comercial", gestor: "lucas@aurora.test", admissaoDias: -380, saidaDias: -20, tipo: "termino_contrato", declarado: "outro" },
];

/** Admissões variadas para quem ainda está com a data padrão do seed (2024-03-01). */
const ADMISSOES: Record<string, number> = {
  "ana@aurora.test": -2400,
  "rafael@aurora.test": -1200,
  "bruno@aurora.test": -1650,
  "carla@aurora.test": -560,
  "diego@aurora.test": -900,
  "elisa@aurora.test": -150,
  "gabriela@aurora.test": -1100,
  "lucas@aurora.test": -1400,
  "marina@aurora.test": -230,
  "nicolas@aurora.test": -75,
};

export async function turnoverDemo(db: Db, tenantId: string) {
  if ((await db.desligamento.count({ where: { tenantId } })) > 0) return false;
  const h = hojeCivil();
  const padrao = new Date("2024-03-01T12:00:00").toISOString().slice(0, 10);
  for (const [email, dias] of Object.entries(ADMISSOES)) {
    const c = await db.colaborador.findUnique({ where: { tenantId_email: { tenantId, email } } });
    if (c && (!c.dataAdmissao || c.dataAdmissao.toISOString().slice(0, 10) === padrao)) await db.colaborador.update({ where: { id: c.id }, data: { dataAdmissao: somarDias(h, dias) } });
  }
  const equipes = new Map((await db.equipe.findMany({ where: { tenantId }, include: { area: true } })).map((e) => [e.nome, e]));
  const porEmail = async (email: string | null) => (email ? await db.colaborador.findUnique({ where: { tenantId_email: { tenantId, email } } }) : null);
  for (const x of EX) {
    const eq = equipes.get(x.equipe)!;
    const gestor = await porEmail(x.gestor);
    const data = somarDias(h, x.saidaDias);
    const c = await db.colaborador.upsert({
      where: { tenantId_email: { tenantId, email: x.email } },
      update: {},
      create: { tenantId, nome: x.nome, email: x.email, cargo: x.cargo, equipeId: eq.id, gestorId: gestor?.id, status: "desligado", dataAdmissao: somarDias(h, x.admissaoDias), desligadoEm: new Date(data.getTime() + 12 * 3600_000) },
    });
    const e = x.entrevista;
    await db.desligamento.create({
      data: {
        tenantId,
        colaboradorId: c.id,
        data,
        tipo: x.tipo,
        voluntario: x.tipo === "pedido_demissao" || x.tipo === "acordo",
        motivoDeclarado: x.declarado,
        perdaLamentada: !!x.lamentada,
        elegivelRecontratacao: x.tipo !== "dispensa_sem_justa_causa",
        cargo: x.cargo,
        equipeId: eq.id,
        equipeNome: eq.nome,
        areaId: eq.areaId,
        areaNome: eq.area?.nome ?? null,
        gestorId: gestor?.id ?? null,
        gestorNome: gestor?.nome ?? null,
        admissao: somarDias(h, x.admissaoDias),
        registradoPor: "Rafael Lima",
        ...(e
          ? {
              entrevistaStatus: "respondida",
              entrevistaModo: "link",
              entrevistaEnviadaEm: new Date(data.getTime() + 86_400_000),
              entrevistaRespondidaEm: new Date(data.getTime() + 3 * 86_400_000),
              respostas: { motivos: e.motivos, motivoPrincipal: e.principal, decisao: e.decisao, experiencia: e.exp, evitavel: e.evitavel, oQueEvitaria: e.oQue ?? null, enps: e.enps, voltaria: e.voltaria, destino: e.destino, sugestoes: e.sugestoes ?? null },
              motivosReais: e.motivos,
              motivoPrincipalReal: e.principal,
              enps: e.enps,
              voltaria: e.voltaria,
              evitavel: e.evitavel,
            }
          : { entrevistaStatus: x.pendente ? "pendente" : "dispensada" }),
      },
    });
  }
  // Ações de retenção (uma atrasada).
  const diego = await porEmail("diego@aurora.test");
  const lucas = await porEmail("lucas@aurora.test");
  const bruno = await porEmail("bruno@aurora.test");
  const rafael = await porEmail("rafael@aurora.test");
  const comercial = equipes.get("Comercial");
  if (diego && bruno)
    await db.acaoRetencao.create({
      data: { tenantId, titulo: "Conversa de carreira e revisão do PDI", descricao: "Feedback no vermelho: alinhar prioridades e apoio em gestão do tempo.", categoria: "crescimento", alcance: "individual", colaboradorId: diego.id, responsavelId: bruno.id, prazo: somarDias(h, -5), status: "em_andamento", origem: "risco", criadoPor: "Rafael Lima" },
    });
  if (comercial && lucas)
    await db.acaoRetencao.create({
      data: { tenantId, titulo: "Garantir cadência de 1:1 e feedback estruturado com o gestor", descricao: "Duas saídas voluntárias citando liderança no Comercial.", categoria: "lideranca", alcance: "equipe", equipeId: comercial.id, responsavelId: lucas.id, prazo: somarDias(h, 30), status: "planejada", origem: "analytics", criadoPor: "Ana Souza" },
    });
  if (rafael)
    await db.acaoRetencao.create({
      data: { tenantId, titulo: "Publicar trilhas de carreira e critérios de promoção", categoria: "crescimento", alcance: "organizacao", responsavelId: rafael.id, prazo: somarDias(h, -40), status: "concluida", resultado: "Trilhas publicadas para Produto e Comercial.", concluidaEm: somarDias(h, -38), origem: "offboarding", criadoPor: "Ana Souza" },
    });
  // Pipeline: prioridades e prazos.
  const vagas = await db.vaga.findMany({ where: { tenantId } });
  for (const v of vagas) {
    if (/Back-end/.test(v.titulo)) await db.vaga.update({ where: { id: v.id }, data: { prioridade: "alta", prazoFechamento: somarDias(h, -3), posicoes: 2 } });
    else if (/Executivo/.test(v.titulo)) await db.vaga.update({ where: { id: v.id }, data: { prioridade: "media", prazoFechamento: somarDias(h, 25) } });
  }
  return true;
}

/** Ativa os novos módulos na organização (seed de desenvolvimento). */
export async function ativarModulos(db: Db, tenantId: string, modulos: Modulo[], responsavelId: string) {
  for (const modulo of modulos) {
    if (await db.entitlement.findUnique({ where: { tenantId_modulo: { tenantId, modulo } } })) continue;
    const e = await db.entitlement.create({ data: { tenantId, modulo, status: "ativo", origem: "sistema" } });
    await db.historicoEntitlement.create({
      data: { tenantId, entitlementId: e.id, modulo, statusNovo: "ativo", inicio: e.inicio, origem: "sistema", responsavelId, responsavelNome: "Seed de desenvolvimento", motivo: "Dados fictícios para testes" },
    });
  }
}

if (process.argv[1]?.endsWith("seed-turnover.ts")) {
  if (process.env.NODE_ENV === "production") throw new Error("Seed de desenvolvimento não roda em produção.");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_MIGRATE_URL }) });
  (async () => {
    const org = await db.organizacao.findUnique({ where: { slug: "aurora-tecnologia" } });
    if (!org) throw new Error("Organização Aurora não encontrada — rode `npm run db:seed` antes.");
    const admin = await db.usuario.findFirst({ where: { superadmin: true } });
    await ativarModulos(db, org.id, ["offboarding", "retencao", "analytics"], admin?.id ?? org.id);
    console.log((await turnoverDemo(db, org.id)) ? "Histórico de turnover criado." : "Histórico de turnover já existia (nada feito).");
  })()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
