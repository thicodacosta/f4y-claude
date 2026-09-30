/**
 * Seed de DESENVOLVIMENTO do JourneyLab — dados fictícios.
 *   npm run db:seed
 * Duas organizações para testar isolamento:
 *   Aurora Tecnologia — os 6 módulos ativos
 *   Bravo Logística   — apenas CRM de Candidatos
 * Senha de todas as contas: JourneyLab2026
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PAPEIS_PADRAO, type Modulo } from "../lib/permissoes";
import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from "../lib/legal";
import { hoje as hojeCivil, somarDias } from "../lib/datas";
import { MODELO_PADRAO } from "../lib/onboarding/modelo-padrao";
import { CRITERIOS_CULTURA, CRITERIOS_PERFORMANCE } from "../lib/feedback/avaliacao";
import { MODELOS_GLOBAIS } from "../lib/pulse/modelos-globais";

if (process.env.NODE_ENV === "production") throw new Error("Seed de desenvolvimento não roda em produção.");

// Conexão administrativa (migrações) — o seed monta dados de várias organizações.
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_MIGRATE_URL }) });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const SENHA = "JourneyLab2026";

async function conta(email: string, nome: string, superadmin = false) {
  const existente = await db.usuario.findUnique({ where: { email } });
  if (existente) return existente.id;
  let id: string;
  const { data, error } = await supabase.auth.admin.createUser({ email, password: SENHA, email_confirm: true, user_metadata: { nome } });
  if (error || !data.user) {
    const { data: lista } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const u = lista.users.find((x) => x.email === email);
    if (!u) throw error ?? new Error(`Falha ao criar ${email}`);
    id = u.id;
  } else id = data.user.id;
  await db.usuario.create({
    data: {
      id,
      email,
      nome,
      superadmin,
      consentimentos: {
        create: [
          { tipo: "termos", versao: VERSAO_TERMOS, aceito: true },
          { tipo: "privacidade", versao: VERSAO_PRIVACIDADE, aceito: true },
        ],
      },
    },
  });
  return id;
}

async function organizacao(slug: string, nome: string, modulos: Modulo[], superadminId: string) {
  const org = await db.organizacao.upsert({ where: { slug }, update: {}, create: { slug, nome, identificadoresExternos: [] } });
  const papeis: Record<string, string> = {};
  for (const p of PAPEIS_PADRAO) {
    const papel = await db.papel.upsert({
      where: { tenantId_nome: { tenantId: org.id, nome: p.nome } },
      update: {},
      create: { tenantId: org.id, nome: p.nome, base: p.base, sistema: true },
    });
    papeis[p.base] = papel.id;
    if ((await db.papelPermissao.count({ where: { papelId: papel.id } })) === 0) {
      await db.papelPermissao.createMany({
        data: p.regras.flatMap(([area, acoes, escopo]) => acoes.map((acao) => ({ tenantId: org.id, papelId: papel.id, area, acao, escopo }))),
      });
    }
  }
  for (const modulo of modulos) {
    const e = await db.entitlement.findUnique({ where: { tenantId_modulo: { tenantId: org.id, modulo } } });
    if (e) continue;
    const novo = await db.entitlement.create({ data: { tenantId: org.id, modulo, status: "ativo", origem: "sistema" } });
    await db.historicoEntitlement.create({
      data: {
        tenantId: org.id,
        entitlementId: novo.id,
        modulo,
        statusNovo: "ativo",
        inicio: novo.inicio,
        origem: "sistema",
        responsavelId: superadminId,
        responsavelNome: "Seed de desenvolvimento",
        motivo: "Dados fictícios para testes",
      },
    });
  }
  return { org, papeis };
}

async function equipe(tenantId: string, nome: string, area: string) {
  const a = await db.area.upsert({ where: { tenantId_nome: { tenantId, nome: area } }, update: {}, create: { tenantId, nome: area } });
  return db.equipe.upsert({ where: { tenantId_nome: { tenantId, nome } }, update: {}, create: { tenantId, nome, areaId: a.id } });
}

async function pessoa(tenantId: string, nome: string, email: string, cargo: string, equipeId: string, gestorId?: string) {
  return db.colaborador.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: {},
    create: { tenantId, nome, email, cargo, equipeId, gestorId, status: "ativo", dataAdmissao: new Date("2024-03-01T12:00:00") },
  });
}

async function vincular(tenantId: string, usuarioId: string, papelId: string, colaboradorId?: string) {
  await db.associacao.upsert({
    where: { tenantId_usuarioId: { tenantId, usuarioId } },
    update: {},
    create: { tenantId, usuarioId, papelId, colaboradorId },
  });
}

type CandSeed = [string, string, string, string, string, string[], string[], number | null, string | null];

async function crm(tenantId: string, autor: string, vagas: { titulo: string; gestorId?: string; equipeId?: string }[], cands: CandSeed[]) {
  const ids: string[] = [];
  for (const v of vagas) {
    const existente = await db.vaga.findFirst({ where: { tenantId, titulo: v.titulo } });
    ids.push(existente ? existente.id : (await db.vaga.create({ data: { tenantId, ...v, criadoPor: autor } })).id);
  }
  for (const [nome, email, telefone, cidade, uf, competencias, tags, vaga, status] of cands) {
    if (await db.candidato.findFirst({ where: { tenantId, emailNorm: email } })) continue;
    const c = await db.candidato.create({
      data: {
        tenantId, nome, email, telefone, cidade, uf, competencias, criadoPor: autor, origem: "Cadastro manual",
        baseLegal: "Consentimento registrado na candidatura (dados fictícios)",
        nomeNorm: nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(),
        emailNorm: email, telefoneNorm: telefone.replace(/\D/g, "").slice(-11),
      },
    });
    for (const t of tags) {
      const tag = await db.tag.upsert({ where: { tenantId_nome: { tenantId, nome: t } }, update: {}, create: { tenantId, nome: t } });
      await db.candidatoTag.create({ data: { tenantId, candidatoId: c.id, tagId: tag.id } });
    }
    await db.interacaoCandidato.create({ data: { tenantId, candidatoId: c.id, tipo: "sistema", texto: "Cadastro criado (seed).", autorNome: autor } });
    if (vaga !== null && status) {
      await db.candidatura.create({ data: { tenantId, vagaId: ids[vaga], candidatoId: c.id, status: status as "inscrito" } });
    }
  }
}

type AjusteTarefa = { status?: "em_andamento" | "bloqueada" | "concluida"; prazoEmDias?: number; motivo?: string };

/** Onboarding de demonstração a partir do template padrão (mesma cópia de fases/tarefas do serviço). */
async function criarOnboardingDemo(
  tenantId: string,
  modeloId: string,
  pessoa: { id: string; gestorId: string | null },
  inicio: Date,
  origem: "manual" | "cadastro",
  ajustes: Record<string, AjusteTarefa> = {},
  concluido = false,
) {
  const hoje = hojeCivil();
  const modelo = await db.modeloOnboarding.findUniqueOrThrow({ where: { id: modeloId }, include: { etapas: { orderBy: { ordem: "asc" }, include: { tarefas: { orderBy: { ordem: "asc" } } } } } });
  const onb = await db.onboarding.create({
    data: { tenantId, colaboradorId: pessoa.id, modeloId, modeloNome: modelo.nome, boasVindas: modelo.boasVindas, inicio, origem, criadoPor: "Rafael Lima" },
  });
  let ordem = 0;
  let total = 0;
  let feitas = 0;
  for (const e of modelo.etapas) {
    const fase = await db.faseOnboarding.create({ data: { tenantId, onboardingId: onb.id, nome: e.titulo, descricao: e.descricao, marcoDias: e.marcoDias, ordem: e.ordem } });
    for (const t of e.tarefas) {
      const aj = ajustes[t.titulo] ?? {};
      const status = concluido ? "concluida" : (aj.status ?? "nao_iniciada");
      const prazoFixo = aj.prazoEmDias !== undefined;
      const prazo = prazoFixo ? somarDias(hoje, aj.prazoEmDias!) : somarDias(inicio, t.prazoDias ?? e.marcoDias);
      total++;
      if (status === "concluida") feitas++;
      await db.tarefaOnboarding.create({
        data: {
          tenantId, onboardingId: onb.id, faseId: fase.id, titulo: t.titulo, descricao: t.descricao, tipo: t.tipo, responsavelTipo: t.responsavel,
          responsavelId: t.responsavel === "gestor" ? pessoa.gestorId : t.responsavel === "colaborador" ? pessoa.id : null,
          obrigatoria: t.obrigatoria, prazoDias: t.prazoDias, prazoFixo, prazo, materialUrl: t.materialUrl, ordem: ordem++, status,
          bloqueioMotivo: status === "bloqueada" ? (aj.motivo ?? "Aguardando terceiros") : null,
          iniciadaEm: status === "nao_iniciada" ? null : inicio,
          concluidaEm: status === "concluida" ? (concluido ? somarDias(inicio, Math.min(t.prazoDias ?? e.marcoDias, 90)) : somarDias(inicio, 1)) : null,
          concluidaPor: status === "concluida" ? (t.responsavel === "gestor" ? "Bruno Martins" : "Rafael Lima") : null,
        },
      });
    }
  }
  await db.onboarding.update({
    where: { id: onb.id },
    data: { progresso: total ? Math.round((feitas / total) * 100) : 0, ...(concluido ? { status: "concluido", concluidoEm: somarDias(inicio, 90), concluidoPor: "Automático — tarefas obrigatórias concluídas" } : {}) },
  });
  await db.eventoOnboarding.create({ data: { tenantId, onboardingId: onb.id, texto: `Onboarding criado (${origem === "cadastro" ? "automaticamente no cadastro" : "manualmente"}) com o template “${modelo.nome}” (seed).`, autorNome: "Rafael Lima" } });
}

/** Onboarding (Aurora): template padrão 30/60/90 e três situações — em andamento com alertas, não iniciado e concluído. Idempotente. */
async function onboardingDemo(tenantId: string, gestorId: string, equipeId: string, papelColaborador: string) {
  let modelo = await db.modeloOnboarding.findFirst({ where: { tenantId, padrao: true } });
  if (!modelo) {
    modelo = await db.modeloOnboarding.create({
      data: {
        tenantId,
        nome: MODELO_PADRAO.nome,
        descricao: MODELO_PADRAO.descricao,
        padrao: true,
        boasVindas: "Que bom ter você com a gente! Nos próximos 90 dias, RH e gestor acompanham sua integração por fases.",
        criadoPor: "Ana Souza",
      },
    });
    for (const [ordem, f] of MODELO_PADRAO.fases.entries()) {
      const e = await db.etapaModelo.create({ data: { tenantId, modeloId: modelo.id, titulo: f.titulo, descricao: f.descricao, marcoDias: f.marcoDias, ordem } });
      await db.tarefaModelo.createMany({ data: f.tarefas.map((t, i) => ({ tenantId, etapaId: e.id, titulo: t.titulo, responsavel: t.responsavel, tipo: t.tipo ?? "tarefa", prazoDias: null, ordem: i })) });
    }
  }
  const hoje = hojeCivil();

  // Em andamento há 10 dias, com tarefas atrasada, vencendo hoje, próxima do prazo e bloqueada.
  const otavio = await db.colaborador.upsert({
    where: { tenantId_email: { tenantId, email: "otavio@aurora.test" } },
    update: {},
    create: { tenantId, nome: "Otávio Pires", email: "otavio@aurora.test", cargo: "Desenvolvedor Full-stack", equipeId, gestorId, status: "pre_admissao", dataAdmissao: somarDias(hoje, -10) },
  });
  await vincular(tenantId, await conta("otavio@aurora.test", "Otávio Pires"), papelColaborador, otavio.id);
  if (!(await db.onboarding.findFirst({ where: { colaboradorId: otavio.id } }))) {
    await criarOnboardingDemo(tenantId, modelo.id, otavio, somarDias(hoje, -10), "manual", {
      "Apresentação da empresa e cultura": { status: "concluida" },
      "Configuração de e-mail e acessos": { status: "bloqueada", motivo: "Aguardando liberação de licença pelo fornecedor" },
      "Reunião com o gestor direto": { status: "em_andamento", prazoEmDias: -3 },
      "Leitura das políticas da empresa": { prazoEmDias: 0 },
      "Conhecer o time": { prazoEmDias: 2 },
    });
  }

  // Admissão em 7 dias: criado automaticamente no cadastro → "Não iniciado".
  const rita = await db.colaborador.upsert({
    where: { tenantId_email: { tenantId, email: "rita@aurora.test" } },
    update: {},
    create: { tenantId, nome: "Rita Campos", email: "rita@aurora.test", cargo: "Product Designer", equipeId, gestorId, status: "pre_admissao", dataAdmissao: somarDias(hoje, 7) },
  });
  if (!(await db.onboarding.findFirst({ where: { colaboradorId: rita.id } }))) {
    await criarOnboardingDemo(tenantId, modelo.id, rita, somarDias(hoje, 7), "cadastro");
  }

  // Concluído (Comercial).
  const marina = await db.colaborador.findUnique({ where: { tenantId_email: { tenantId, email: "marina@aurora.test" } } });
  if (marina && !(await db.onboarding.findFirst({ where: { colaboradorId: marina.id } }))) {
    await criarOnboardingDemo(tenantId, modelo.id, marina, somarDias(hoje, -100), "manual", {}, true);
  }
}

/** Feedback 1:1 e PDI (Aurora): 1:1 realizado com anotações e compromissos, próximo 1:1 agendado e PDI ativo. Idempotente. */
async function feedbackPdiDemo(tenantId: string, gestor: { id: string; uid: string }, pessoa: { id: string; uid: string }) {
  const dias = (n: number, hora = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(hora, 0, 0, 0);
    return d;
  };
  const itens = ["Como você está?", "Prioridades das próximas duas semanas", "Bloqueios e apoio necessário", "Desenvolvimento e carreira"];
  await db.modeloPauta.upsert({
    where: { tenantId_nome: { tenantId, nome: "1:1 quinzenal" } },
    update: {},
    create: { tenantId, nome: "1:1 quinzenal", itens, criadoPor: "Ana Souza" },
  });
  if (await db.reuniao.findFirst({ where: { tenantId, colaboradorId: pessoa.id } })) return;

  const passada = await db.reuniao.create({
    data: { tenantId, gestorId: gestor.id, colaboradorId: pessoa.id, dataHora: dias(-7), status: "realizada", realizadaEm: dias(-7, 11), pauta: itens, modeloNome: "1:1 quinzenal", criadoPor: "Bruno Martins" },
  });
  await db.anotacaoReuniao.createMany({
    data: [
      { tenantId, reuniaoId: passada.id, autorUsuarioId: gestor.uid, autorNome: "Bruno Martins", visibilidade: "compartilhada", texto: "Boa evolução na pesquisa com usuários. Combinamos que a Carla vai apresentar o roadmap de design na próxima reunião de produto." },
      { tenantId, reuniaoId: passada.id, autorUsuarioId: gestor.uid, autorNome: "Bruno Martins", visibilidade: "privada", texto: "Nota privada do gestor: avaliar a Carla para liderar o squad de onboarding no próximo trimestre." },
      { tenantId, reuniaoId: passada.id, autorUsuarioId: pessoa.uid, autorNome: "Carla Mendes", visibilidade: "privada", texto: "Nota privada da colaboradora: pedir feedback mais frequente sobre apresentações." },
      { tenantId, reuniaoId: passada.id, autorUsuarioId: pessoa.uid, autorNome: "Carla Mendes", visibilidade: "compartilhada", texto: "Quero desenvolver comunicação com executivos. Preciso de acesso ao curso de storytelling." },
    ],
  });
  const apresentar = await db.compromisso.create({
    data: { tenantId, reuniaoId: passada.id, responsavelId: pessoa.id, descricao: "Apresentar o roadmap de design para a liderança de produto", prazo: dias(10), criadoPor: "Bruno Martins" },
  });
  await db.compromisso.create({
    data: { tenantId, reuniaoId: passada.id, responsavelId: gestor.id, descricao: "Liberar acesso ao curso de storytelling", prazo: dias(-2), status: "concluido", concluidoEm: dias(-3), concluidoPor: "Bruno Martins", criadoPor: "Bruno Martins" },
  });
  await db.compromisso.create({
    data: { tenantId, reuniaoId: passada.id, responsavelId: pessoa.id, descricao: "Mapear pontos de atrito do onboarding de clientes", prazo: dias(-1), criadoPor: "Bruno Martins" },
  });
  await db.reuniao.create({
    data: { tenantId, gestorId: gestor.id, colaboradorId: pessoa.id, dataHora: dias(3, 15), pauta: itens, modeloNome: "1:1 quinzenal", criadoPor: "Bruno Martins" },
  });

  const inicio = dias(-30);
  const fim = dias(150);
  const pdi = await db.pdi.create({
    data: { tenantId, colaboradorId: pessoa.id, titulo: "Desenvolvimento 2026 · Design de Produto", inicio, fim, status: "ativo", criadoPor: "Bruno Martins" },
  });
  const comunicacao = await db.objetivoPdi.create({
    data: { tenantId, pdiId: pdi.id, titulo: "Comunicar decisões de design para executivos", competencia: "Comunicação", descricao: "Conduzir apresentações para a liderança com clareza e segurança.", ordem: 0 },
  });
  const pesquisa = await db.objetivoPdi.create({
    data: { tenantId, pdiId: pdi.id, titulo: "Aprofundar pesquisa com usuários", competencia: "Pesquisa", ordem: 1 },
  });
  await db.acaoPdi.createMany({
    data: [
      { tenantId, pdiId: pdi.id, objetivoId: comunicacao.id, titulo: "Curso de storytelling para apresentações", tipo: "curso", prazo: dias(20), status: "em_andamento", criadoPor: "Bruno Martins" },
      { tenantId, pdiId: pdi.id, objetivoId: comunicacao.id, titulo: apresentar.descricao, tipo: "pratica", prazo: apresentar.prazo, compromissoOrigemId: apresentar.id, criadoPor: "Bruno Martins" },
      { tenantId, pdiId: pdi.id, objetivoId: pesquisa.id, titulo: "Conduzir 5 entrevistas com clientes", tipo: "pratica", prazo: dias(-5), status: "concluida", evidencia: "Relatório de síntese compartilhado com o time.", concluidaEm: dias(-6), criadoPor: "Bruno Martins" },
    ],
  });
  await db.registroPdi.createMany({
    data: [
      { tenantId, pdiId: pdi.id, tipo: "evento", texto: "PDI criado em rascunho.", autorNome: "Bruno Martins", criadoEm: dias(-30) },
      { tenantId, pdiId: pdi.id, tipo: "evento", texto: "PDI ativado.", autorNome: "Bruno Martins", criadoEm: dias(-29) },
      { tenantId, pdiId: pdi.id, tipo: "revisao", texto: "Primeira revisão: bom ritmo nas entrevistas; manter foco na comunicação.", autorNome: "Bruno Martins", criadoEm: dias(-5) },
    ],
  });
}

/** Templates globais do Pulse (tenant nulo — visíveis a todas as organizações). */
async function modelosPulseGlobais() {
  for (const m of MODELOS_GLOBAIS) {
    const atual = await db.modeloPulse.findFirst({ where: { tenantId: null, slug: m.slug } });
    const dados = { nome: m.nome, descricao: m.descricao, icone: m.icone, cor: m.cor, perguntas: m.perguntas, ativo: true };
    if (atual) await db.modeloPulse.update({ where: { id: atual.id }, data: dados });
    else await db.modeloPulse.create({ data: { ...dados, slug: m.slug } });
  }
}

/**
 * Pulse (Aurora): uma pesquisa anônima encerrada com respostas fictícias (para
 * ver resultados, eNPS e o bloqueio por mínimo de respondentes) e uma ativa com
 * convites. O seed usa a conexão administrativa — a aplicação nunca grava
 * respostas diretamente.
 */
async function pulseDemo(tenantId: string) {
  if (await db.pesquisaPulse.findFirst({ where: { tenantId, titulo: "Clima rápido · setembro" } })) return;
  const h = hojeCivil();
  const cfg = (chave: string, extra: Record<string, unknown> = {}) => ({ chave, ...extra });
  const perguntas = [
    { texto: "Tenho clareza sobre o que se espera do meu trabalho.", tipo: "likert", obrigatoria: true, config: cfg("q0") },
    { texto: "Recebo reconhecimento pelo trabalho bem feito.", tipo: "likert", obrigatoria: true, config: cfg("q1") },
    { texto: "Minha carga de trabalho é sustentável.", tipo: "likert", obrigatoria: true, config: cfg("q2") },
    {
      texto: "Qual a probabilidade de você recomendar a empresa como lugar para trabalhar?",
      tipo: "nps",
      obrigatoria: true,
      config: cfg("q3", { scaleMin: 0, scaleMax: 10, scaleMinLabel: "Nada provável", scaleMaxLabel: "Muito provável" }),
    },
    { texto: "Quer comentar algo? (opcional)", tipo: "long_text", obrigatoria: false, config: cfg("q4") },
  ];
  const ativos = await db.colaborador.findMany({ where: { tenantId, status: "ativo" }, select: { id: true, equipeId: true, email: true, equipe: { select: { areaId: true } } }, orderBy: { nome: "asc" } });
  const encerrada = await db.pesquisaPulse.create({
    data: {
      tenantId,
      titulo: "Clima rápido · setembro",
      descricao: "Termômetro rápido de clareza, reconhecimento e carga de trabalho.",
      status: "encerrada",
      anonima: true,
      audienciaTipo: "todos",
      dataInicio: somarDias(h, -21),
      encerraEm: somarDias(h, -7),
      abertaEm: somarDias(h, -21),
      encerradaEm: somarDias(h, -7),
      publicoTotal: ativos.length,
      modeloSlug: "clima-organizacional",
      criadoPor: "Rafael Lima",
    },
  });
  const qs = [];
  for (const [ordem, q] of perguntas.entries()) qs.push(await db.perguntaPulse.create({ data: { ...q, ordem, tenantId, pesquisaId: encerrada.id } }));

  // Carla fica de fora da encerrada só para variar; os demais ativos responderam.
  const respondentes = ativos.filter((c) => c.email !== "carla@aurora.test").slice(0, 11);
  const comentarios = ["Gostaria de mais clareza sobre prioridades do trimestre.", "O time é muito colaborativo.", "Reuniões demais às sextas."];
  for (const [i, c] of respondentes.entries()) {
    await db.participacaoPulse.create({ data: { tenantId, pesquisaId: encerrada.id, colaboradorId: c.id, respondidoEm: somarDias(h, -14 + (i % 5)) } });
    const lote = crypto.randomUUID();
    const valores = [3 + (i % 3), 2 + ((i * 2) % 4), 2 + (i % 4), [9, 10, 7, 8, 6, 9, 10, 5, 8, 9, 7][i % 11]];
    const base = { tenantId, pesquisaId: encerrada.id, lote, equipeId: c.equipeId, areaId: c.equipe?.areaId ?? null };
    for (const [k, q] of qs.entries()) {
      if (q.tipo === "long_text") {
        if (i < comentarios.length) await db.respostaPulse.create({ data: { ...base, perguntaId: q.id, texto: comentarios[i] } });
      } else await db.respostaPulse.create({ data: { ...base, perguntaId: q.id, valor: Math.min(q.tipo === "likert" ? 5 : 10, valores[k]) } });
    }
  }

  const aberta = await db.pesquisaPulse.create({
    data: {
      tenantId,
      titulo: "eNPS · outubro",
      descricao: "Duas perguntas rápidas sobre recomendar a Aurora como lugar para trabalhar.",
      status: "aberta",
      anonima: true,
      audienciaTipo: "todos",
      dataInicio: h,
      encerraEm: somarDias(h, 14),
      abertaEm: new Date(),
      publicoTotal: ativos.length,
      modeloSlug: "enps",
      criadoPor: "Rafael Lima",
    },
  });
  await db.perguntaPulse.createMany({
    data: [
      { tenantId, pesquisaId: aberta.id, texto: "Qual a probabilidade de você recomendar a empresa como lugar para trabalhar?", tipo: "nps", obrigatoria: true, ordem: 0, config: perguntas[3].config },
      { tenantId, pesquisaId: aberta.id, texto: "O que mais influenciou sua nota?", tipo: "long_text", obrigatoria: false, ordem: 1, config: cfg("q1") },
    ],
  });
  await db.convitePulse.createMany({ data: ativos.map((c) => ({ tenantId, pesquisaId: aberta.id, colaboradorId: c.id, enviadoEm: new Date() })) });
}

/** NR-1 (Aurora): ciclo encerrado com respostas fictícias, riscos e plano de ação; e um ciclo aberto. */
async function nr1Demo(tenantId: string) {
  if (await db.cicloNr1.findFirst({ where: { tenantId, titulo: "Diagnóstico psicossocial · 1º semestre" } })) return;
  const { QUESTIONARIO_REFERENCIA } = await import("../lib/nr1/questionario");
  const criarCiclo = async (titulo: string, status: "aberto" | "encerrado") => {
    const d = new Date();
    const c = await db.cicloNr1.create({
      data: {
        tenantId,
        titulo,
        status,
        abertoEm: new Date(d.getTime() - (status === "encerrado" ? 60 : 2) * 86_400_000),
        encerradoEm: status === "encerrado" ? new Date(d.getTime() - 30 * 86_400_000) : null,
        encerraEm: status === "aberto" ? new Date(d.getTime() + 20 * 86_400_000) : null,
        criadoPor: "Ana Souza",
      },
    });
    const perguntas: { id: string; dim: number; invertida: boolean }[] = [];
    let ordemQ = 0;
    for (const [i, dim] of QUESTIONARIO_REFERENCIA.entries()) {
      const dd = await db.dimensaoNr1.create({ data: { tenantId, cicloId: c.id, nome: dim.nome, descricao: dim.descricao, ordem: i } });
      for (const [texto, invertida] of dim.perguntas) {
        const q = await db.perguntaNr1.create({ data: { tenantId, cicloId: c.id, dimensaoId: dd.id, texto, invertida, ordem: ordemQ++ } });
        perguntas.push({ id: q.id, dim: i, invertida });
      }
    }
    return { c, perguntas };
  };

  const { c, perguntas } = await criarCiclo("Diagnóstico psicossocial · 1º semestre", "encerrado");
  const ativos = await db.colaborador.findMany({ where: { tenantId, status: "ativo" }, select: { id: true, equipeId: true, email: true }, orderBy: { nome: "asc" } });
  const respondentes = ativos.filter((p) => p.email !== "carla@aurora.test").slice(0, 11);
  // Perfil fictício: "Demandas e ritmo" desfavorável; "Relações" favorável; demais intermediários.
  const favorabilidade = [0.3, 0.55, 0.65, 0.85, 0.7, 0.5, 0.45];
  for (const [n, p] of respondentes.entries()) {
    await db.participacaoNr1.create({ data: { tenantId, cicloId: c.id, colaboradorId: p.id, respondidoEm: new Date(Date.now() - 45 * 86_400_000) } });
    const lote = crypto.randomUUID();
    await db.respostaNr1.createMany({
      data: perguntas.map((q, k) => {
        const alvo = favorabilidade[q.dim] + (((n + k) % 3) - 1) * 0.12;
        const fav = Math.min(4, Math.max(0, Math.round(alvo * 4)));
        return { tenantId, cicloId: c.id, perguntaId: q.id, lote, equipeId: p.equipeId, valor: q.invertida ? 5 - fav : fav + 1 };
      }),
    });
  }
  const demandas = await db.dimensaoNr1.findFirst({ where: { cicloId: c.id, nome: "Demandas e ritmo de trabalho" } });
  const risco = await db.riscoNr1.create({
    data: { tenantId, cicloId: c.id, dimensaoId: demandas?.id, titulo: "Ritmo intenso recorrente e metas percebidas como pouco alcançáveis", descricao: "Índice da dimensão na faixa prioritária em toda a organização.", prioridade: "alta", status: "em_tratamento", criadoPor: "Ana Souza" },
  });
  await db.acaoNr1.createMany({
    data: [
      { tenantId, riscoId: risco.id, titulo: "Revisar distribuição de demandas nos fechamentos mensais", responsavelNome: "Diretoria de Operações", prazo: new Date(Date.now() + 15 * 86_400_000), status: "em_andamento", criadoPor: "Ana Souza" },
      { tenantId, riscoId: risco.id, titulo: "Rodada de escuta com lideranças sobre metas do trimestre", responsavelNome: "Pessoas e Cultura", prazo: new Date(Date.now() - 5 * 86_400_000), status: "pendente", criadoPor: "Ana Souza" },
    ],
  });
  await criarCiclo("Diagnóstico psicossocial · 2º semestre", "aberto");
}

/** Feedback 1:1 avaliado (Aurora): cenários de semáforo e de cadência. Idempotente. */
async function avaliacoesDemo(tenantId: string, autor: { id: string; nome: string }) {
  if (await db.avaliacaoFeedback.findFirst({ where: { tenantId } })) return;
  const hoje = hojeCivil();
  const campos = [...CRITERIOS_PERFORMANCE, ...CRITERIOS_CULTURA].map((c) => c.campo);
  const notas = (lista: number[]) => Object.fromEntries(campos.map((c, i) => [c, lista[i % lista.length]]));
  const pessoa = (email: string) => db.colaborador.findUniqueOrThrow({ where: { tenantId_email: { tenantId, email } } });
  const registrar = async (email: string, diasAtras: number, periodicidade: "mensal" | "bimestral" | "trimestral", n: number[], observacoes: string) => {
    const p = await pessoa(email);
    // Médias e semáforo são calculados pelo gatilho do banco (jl_calcular_avaliacao).
    await db.avaliacaoFeedback.create({
      data: { tenantId, colaboradorId: p.id, gestorId: p.gestorId, data: somarDias(hoje, -diasAtras), periodicidade, ...notas(n), observacoes, autorId: autor.id, autorNome: autor.nome } as never,
    });
  };
  await registrar("carla@aurora.test", 55, "mensal", [3, 3, 4, 3, 2, 4, 3, 3], "Boa evolução técnica; combinar prioridades semanais.");
  await registrar("carla@aurora.test", 25, "mensal", [4, 5, 4, 4, 4, 5, 4, 4], "Apresentou o roadmap com segurança. Manter ritmo.");
  await registrar("diego@aurora.test", 45, "mensal", [2, 2, 3, 1, 2, 3, 3, 2], "Entregas atrasando; alinhar prioridades e apoio em gestão do tempo.");
  await registrar("gabriela@aurora.test", 20, "trimestral", [4, 4, 5, 4, 4, 4, 5, 4], "Referência em qualidade para o time.");
  await registrar("marina@aurora.test", 10, "bimestral", [3, 4, 3, 3, 4, 3, 4, 3], "Bom relacionamento com clientes; aprofundar ferramentas de CRM.");
  // Nunca recebeu feedback: referência pela data de entrada (40 dias → atrasado).
  await db.colaborador.update({ where: { tenantId_email: { tenantId, email: "fabio@aurora.test" } }, data: { dataAdmissao: somarDias(hoje, -40) } });
}

async function main() {
  const superadmin = await conta("admin@journeylab.local", "Equipe JourneyLab", true);
  await modelosPulseGlobais();

  // ── Aurora: todos os módulos ──
  const aurora = await organizacao("aurora-tecnologia", "Aurora Tecnologia", ["crm", "onboarding", "feedback", "pulse", "pdi", "nr1"], superadmin);
  const A = aurora.org.id;
  const produto = await equipe(A, "Produto", "Tecnologia");
  const comercial = await equipe(A, "Comercial", "Negócios");
  const pessoasRh = await equipe(A, "Pessoas e Cultura", "Corporativo");
  const ana = await pessoa(A, "Ana Souza", "ana@aurora.test", "Diretora de Pessoas", pessoasRh.id);
  const rafael = await pessoa(A, "Rafael Lima", "rafael@aurora.test", "Analista de RH", pessoasRh.id, ana.id);
  const bruno = await pessoa(A, "Bruno Martins", "bruno@aurora.test", "Head de Produto", produto.id);
  await db.equipe.update({ where: { id: produto.id }, data: { gestorId: bruno.id } });
  await db.equipe.update({ where: { id: pessoasRh.id }, data: { gestorId: ana.id } });
  const carla = await pessoa(A, "Carla Mendes", "carla@aurora.test", "Designer de Produto", produto.id, bruno.id);
  for (const [n, e, c] of [
    ["Diego Ferreira", "diego@aurora.test", "Desenvolvedor Back-end"],
    ["Elisa Rocha", "elisa@aurora.test", "Desenvolvedora Front-end"],
    ["Fábio Nunes", "fabio@aurora.test", "Analista de Dados"],
    ["Gabriela Alves", "gabriela@aurora.test", "QA"],
  ]) {
    await pessoa(A, n, e, c, produto.id, bruno.id);
  }
  const lucas = await pessoa(A, "Lucas Prado", "lucas@aurora.test", "Gerente Comercial", comercial.id);
  await db.equipe.update({ where: { id: comercial.id }, data: { gestorId: lucas.id } });
  for (const [n, e, c] of [
    ["Marina Costa", "marina@aurora.test", "Executiva de Contas"],
    ["Nicolas Reis", "nicolas@aurora.test", "SDR"],
  ]) {
    await pessoa(A, n, e, c, comercial.id, lucas.id);
  }
  await vincular(A, await conta("ana@aurora.test", "Ana Souza"), aurora.papeis.admin_org, ana.id);
  await vincular(A, await conta("rafael@aurora.test", "Rafael Lima"), aurora.papeis.rh, rafael.id);
  const brunoUid = await conta("bruno@aurora.test", "Bruno Martins");
  const carlaUid = await conta("carla@aurora.test", "Carla Mendes");
  await vincular(A, brunoUid, aurora.papeis.gestor, bruno.id);
  await vincular(A, carlaUid, aurora.papeis.colaborador, carla.id);

  // ── Bravo: só CRM ──
  const bravo = await organizacao("bravo-logistica", "Bravo Logística", ["crm"], superadmin);
  const B = bravo.org.id;
  const operacoes = await equipe(B, "Operações", "Logística");
  const helena = await pessoa(B, "Helena Duarte", "helena@bravo.test", "Gerente de RH", operacoes.id);
  await pessoa(B, "Igor Santos", "igor@bravo.test", "Coordenador de Operações", operacoes.id, helena.id);
  await pessoa(B, "Joana Pires", "joana@bravo.test", "Analista de Logística", operacoes.id, helena.id);
  await vincular(B, await conta("helena@bravo.test", "Helena Duarte"), bravo.papeis.admin_org, helena.id);

  // ── Consultor em duas organizações, com papéis diferentes ──
  const consultor = await conta("consultor@parceiro.test", "Paula Consultora");
  await vincular(A, consultor, aurora.papeis.rh);
  await vincular(B, consultor, bravo.papeis.admin_org);

  // ── Onboarding (dados fictícios) ──
  await onboardingDemo(A, bruno.id, produto.id, aurora.papeis.colaborador);

  // ── Feedback 1:1 e PDI (dados fictícios) ──
  await feedbackPdiDemo(A, { id: bruno.id, uid: brunoUid }, { id: carla.id, uid: carlaUid });

  // ── Feedback 1:1 avaliado (dados fictícios) ──
  await avaliacoesDemo(A, { id: brunoUid, nome: "Bruno Martins" });

  // ── Pulse (dados fictícios) ──
  await pulseDemo(A);

  // ── Diagnóstico NR-1 (dados fictícios) ──
  await nr1Demo(A);

  // ── CRM (dados fictícios) ──
  await crm(A, "Ana Souza", [
    { titulo: "Pessoa Desenvolvedora Back-end Pleno", gestorId: bruno.id, equipeId: produto.id },
    { titulo: "Executivo(a) de Contas", gestorId: lucas.id, equipeId: comercial.id },
  ], [
    ["Beatriz Oliveira", "beatriz.oliveira@exemplo.test", "(11) 98888-1001", "São Paulo", "SP", ["Node.js", "PostgreSQL"], ["Back-end", "Indicação"], 0, "entrevista"],
    ["Caio Fernandes", "caio.fernandes@exemplo.test", "(11) 98888-1002", "Campinas", "SP", ["Java", "AWS"], ["Back-end"], 0, "em_avaliacao"],
    ["Daniela Moura", "daniela.moura@exemplo.test", "(21) 97777-2001", "Rio de Janeiro", "RJ", ["TypeScript", "Node.js"], ["Back-end", "Talento sênior"], 0, "aprovado"],
    ["Eduardo Tavares", "eduardo.tavares@exemplo.test", "(31) 96666-3001", "Belo Horizonte", "MG", ["Negociação", "CRM"], ["Comercial"], 1, "inscrito"],
    ["Fernanda Lopes", "fernanda.lopes@exemplo.test", "(41) 95555-4001", "Curitiba", "PR", ["Prospecção", "SaaS"], ["Comercial", "Indicação"], 1, "entrevista"],
    ["Gustavo Ribeiro", "gustavo.ribeiro@exemplo.test", "(11) 94444-5001", "São Paulo", "SP", ["Python"], ["Banco de talentos"], null, null],
  ]);
  await crm(B, "Helena Duarte", [{ titulo: "Motorista de Entregas", equipeId: operacoes.id }], [
    ["Henrique Castro", "henrique.castro@exemplo.test", "(51) 93333-6001", "Porto Alegre", "RS", ["CNH D"], ["Operações"], 0, "inscrito"],
    ["Isabela Freitas", "isabela.freitas@exemplo.test", "(51) 93333-6002", "Canoas", "RS", ["CNH D", "Empilhadeira"], ["Operações"], 0, "entrevista"],
    ["João Batista", "joao.batista@exemplo.test", "(51) 93333-6003", "Porto Alegre", "RS", ["Roteirização"], ["Banco de talentos"], null, null],
  ]);

  console.log("Seed concluído. Senha de todas as contas:", SENHA);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
