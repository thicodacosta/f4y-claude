/**
 * Cenário de demonstração sobre a base real de colaboradores, para testar
 * todas as funcionalidades com dados plausíveis. Reversível: tudo o que é
 * criado fica marcado (demo = true) e os campos preenchidos nos cadastros
 * reais ficam guardados em demo_original (migração 20261009150000_bp_demo).
 *
 * Enredo (12 meses):
 *  - Comercial em queda de Produtividade e Cultura, com 3 saídas voluntárias
 *    do mesmo gestor (remuneração, liderança, proposta) — aciona os sinais de
 *    risco de gestor e de área.
 *  - Tecnologia forte, mas com dois talentos em queda recente.
 *  - Operações em recuperação; RH e Diretoria estáveis e bem avaliados.
 *  - 5 pessoas em onboarding (uma com fase atrasada).
 *  - 6 ex-colaboradores fictícios com entrevista de desligamento respondida
 *    (a base ativa continua com as pessoas reais).
 *  - 2 pesquisas de Pulso: Engajamento há 3 meses e Clima no mês passado,
 *    com o Comercial piorando e Operações melhorando.
 * Os números são gerados por sorteio com semente fixa por empresa: o mesmo
 * cenário sai igual a cada geração.
 */
import { carregar, sinalizarMudanca, store } from "./db.js";
import * as I from "./indicadores.js";
import { ENTREVISTA_DESLIGAMENTO, MODELOS } from "./pesquisas.js";
import * as calc from "./toolskit.js";
import { FriendlyError, supabase } from "./toolskit.js";

// ─── Sorteio com semente ───────────────────────────────────────────────────

function sorteador(semente) {
  let a = [...semente].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0, 2166136261);
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    r,
    entre: (min, max) => min + r() * (max - min),
    inteiro: (min, max) => Math.floor(min + r() * (max - min + 1)),
    item: (lista) => lista[Math.floor(r() * lista.length)],
    ruido: (amp) => (r() + r() + r() - 1.5) * (amp / 1.5),
    embaralhar: (lista) => {
      const l = [...lista];
      for (let i = l.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [l[i], l[j]] = [l[j], l[i]];
      }
      return l;
    },
  };
}

const hoje = I.hojeISO();
const diasAtras = (n) => I.somarDias(hoje, -Math.round(n));
const tsDiasAtras = (n, hora = 10) => new Date(`${diasAtras(n)}T${String(hora).padStart(2, "0")}:00:00`).toISOString();
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

// ─── Perfis por cargo e área ───────────────────────────────────────────────

export function areaDoCargo(cargo = "") {
  const c = cargo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/diretor|ceo|presidente|conselho/.test(c)) return "Diretoria";
  if (/\brh\b|recrut|pessoal|treinamento|people|talent/.test(c)) return "Pessoas e RH";
  if (/marketing|conteudo|marca/.test(c)) return "Marketing";
  if (/tecnolog|desenvolv|\bqa\b|dados|suporte|engenh|sistemas|produto|ti\b|devops/.test(c)) return "Tecnologia";
  if (/comercial|vendas|contas|consultor|sdr|negocios/.test(c)) return "Comercial";
  if (/financ|contab|controlad|fiscal|compras|tesour/.test(c)) return "Financeiro";
  return "Operações";
}

function salarioDoCargo(cargo = "", s) {
  const c = cargo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const base = /diretor|ceo/.test(c) ? 38000 : /gerente|head/.test(c) ? 19000 : /coordenad|especialista|senior|lider/.test(c) ? 12500 : /assistente|auxiliar|estagi/.test(c) ? 3800 : /analista|desenvolv|consultor|executivo|recrutador/.test(c) ? 7200 : 6000;
  return Math.round((base * s.entre(0.9, 1.15)) / 100) * 100;
}

const lideranca = (cargo = "") => /diretor|gerente|head|coordenad/i.test(cargo);

// Tendência trimestral por área: [prod inicial, variação por trimestre, cultura inicial, variação].
const TENDENCIA = {
  Comercial: [3.8, -0.18, 3.6, -0.24],
  Tecnologia: [4.2, 0.04, 3.9, 0],
  "Pessoas e RH": [4.0, 0.05, 4.2, 0.02],
  Financeiro: [3.6, 0, 3.7, 0.02],
  Operações: [3.1, 0.2, 3.3, 0.18],
  Marketing: [3.8, 0, 3.9, 0],
  Diretoria: [4.3, 0, 4.4, 0],
};
// Critérios mais fracos de cada área (−0,6).
const FRACOS = {
  Comercial: ["priorizacao", "confianca", "colaboracao"],
  Tecnologia: ["comunicacao", "colaboracao"],
  Operações: ["ferramentas", "longoPrazo"],
  Financeiro: ["criatividade"],
};
// Viés de favorabilidade no Pulso (0–1) por área: [Engajamento, Clima].
const CLIMA = {
  Comercial: [0.48, 0.36],
  Tecnologia: [0.72, 0.7],
  "Pessoas e RH": [0.78, 0.8],
  Financeiro: [0.62, 0.63],
  Operações: [0.48, 0.62],
  Marketing: [0.68, 0.66],
  Diretoria: [0.82, 0.82],
};

const COMENTARIOS = [
  "Mais clareza sobre as prioridades do trimestre.",
  "Reconhecimento mais frequente das entregas do time.",
  "Revisar a carga de trabalho no fechamento do mês.",
  "Gosto muito do time e da autonomia que temos.",
  "Precisamos de um plano de carreira mais claro.",
  "A comunicação entre as áreas melhorou, mas ainda falta alinhamento.",
  "Feedbacks mais regulares da liderança ajudariam.",
  "Ferramentas mais integradas economizariam tempo.",
  "Benefícios de saúde mental fariam diferença.",
  "A política de trabalho híbrido funciona bem para mim.",
];

// ─── Respostas de pesquisa ─────────────────────────────────────────────────

function resposta(p, vies, s) {
  const v = limitar(vies + s.ruido(0.35), 0, 1);
  switch (p.tipo) {
    case "likert":
    case "escala":
      return limitar(Math.round(1 + 4 * v), 1, 5);
    case "nps":
      return limitar(Math.round(10 * limitar(v + 0.08, 0, 1)), 0, 10);
    case "simnao":
      return s.r() < v ? "sim" : "nao";
    case "escolha": {
      if (p.opcoes.some((o) => o.valor != null)) {
        const ordenadas = [...p.opcoes].sort((a, b) => b.valor - a.valor);
        return ordenadas[limitar(Math.round((1 - v) * (ordenadas.length - 1)), 0, ordenadas.length - 1)].id;
      }
      return s.item(p.opcoes).id;
    }
    case "multipla":
      return s.embaralhar(p.opcoes).slice(0, s.inteiro(1, Math.min(3, p.opcoes.length))).map((o) => o.id);
    case "texto":
      return s.r() < 0.35 ? s.item(COMENTARIOS) : null;
    default:
      return null;
  }
}

const respostasDe = (perguntas, vies, s) =>
  Object.fromEntries(perguntas.map((p) => [p.id, resposta(p, vies, s)]).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)));

// Opções da entrevista de desligamento por motivo (ordem do questionário).
const OPCAO_MOTIVO = { remuneracao: "o1", crescimento: "o2", lideranca: "o3", cultura: "o4", carga: "o5", reconhecimento: "o6", proposta: "o7", flexibilidade: "o8", pessoal: "o9", desempenho: "o10", reestruturacao: "o10", outro: "o10" };

function entrevista(motivo, s) {
  const [motivos, principal, ...resto] = ENTREVISTA_DESLIGAMENTO;
  const extra = s.item(motivos.opcoes.filter((o) => o.id !== OPCAO_MOTIVO[motivo]));
  const r = { [motivos.id]: [OPCAO_MOTIVO[motivo], extra.id], [principal.id]: OPCAO_MOTIVO[motivo] };
  for (const p of resto) {
    // Liderança e o próprio motivo saem com as piores notas.
    const ruim = (motivo === "lideranca" && /lideranca/i.test(p.texto.normalize("NFD").replace(/[̀-ͯ]/g, ""))) || (motivo === "remuneracao" && /Remunera/.test(p.texto)) || (motivo === "crescimento" && /crescimento/.test(p.texto));
    const valor = resposta(p, ruim ? 0.1 : p.tipo === "nps" ? 0.45 : 0.55, s);
    if (valor != null) r[p.id] = valor;
  }
  return r;
}

// ─── Gravação em lote ──────────────────────────────────────────────────────

async function inserirLote(tabela, linhas, campos = "*") {
  const saida = [];
  for (let i = 0; i < linhas.length; i += 200) {
    const { data, error } = await supabase.from(tabela).insert(linhas.slice(i, i + 200)).select(campos);
    if (error) throw error;
    saida.push(...data);
  }
  return saida;
}

async function emParalelo(itens, fn, n = 8) {
  for (let i = 0; i < itens.length; i += n) {
    const r = await Promise.all(itens.slice(i, i + n).map(fn));
    const falha = r.find((x) => x?.error);
    if (falha) throw falha.error;
  }
}

export async function existeDemo() {
  const { data, error } = await supabase.from("bp_colaboradores").select("id").eq("empresa_id", store.empresaId).not("demo_original", "is", null).limit(1);
  if (error) {
    if (/demo_original/.test(error.message)) throw new FriendlyError("Rode a migração do cenário de demonstração no Supabase antes (supabase/migrations/20261009150000_bp_demo.sql).");
    throw error;
  }
  return data.length > 0;
}

// ─── Gerar ─────────────────────────────────────────────────────────────────

export async function gerarDemo(progresso = () => {}) {
  if (await existeDemo()) throw new FriendlyError("O cenário de demonstração já está ativo. Remova-o antes de gerar de novo.");
  const s = sorteador(store.empresaId);
  const E = store.empresaId;
  const reais = store.colaboradores.filter((c) => c.status === "ativo");
  if (reais.length < 8) throw new FriendlyError("Cadastre pelo menos 8 colaboradores antes de gerar o cenário.");

  // 1. Completa os cadastros (só campos vazios), guardando o original.
  progresso("Completando os cadastros (área, admissão, remuneração)…");
  const ordem = s.embaralhar(reais);
  const novatos = ordem.filter((c) => !lideranca(c.cargo)).slice(0, 5);
  const diasNovatos = [12, 28, 47, 63, 85];
  const recentes = new Set(ordem.filter((c) => !novatos.includes(c)).slice(0, 8).map((c) => c.id));
  const enriquecidos = new Map();
  await emParalelo(reais, (c) => {
    const area = c.area ?? areaDoCargo(c.cargo ?? "");
    const idxNovato = novatos.indexOf(c);
    const admissao =
      c.admissao ??
      (idxNovato >= 0 ? diasAtras(diasNovatos[idxNovato]) : recentes.has(c.id) ? diasAtras(s.inteiro(120, 360)) : diasAtras(lideranca(c.cargo) ? s.inteiro(900, 2400) : s.inteiro(420, 2200)));
    const novo = {
      area,
      admissao,
      salario: c.salario ?? salarioDoCargo(c.cargo ?? "", s),
      vinculo: c.vinculo && c.vinculo !== "clt" ? c.vinculo : /desenvolv/i.test(c.cargo ?? "") && s.r() < 0.3 ? "pj" : "clt",
      demo_original: { area: c.area, admissao: c.admissao, salario: c.salario, vinculo: c.vinculo },
    };
    enriquecidos.set(c.id, { ...c, ...novo });
    return supabase.from("bp_colaboradores").update(novo).eq("id", c.id);
  });
  const pessoas = [...enriquecidos.values()];

  // 2. Avaliações trimestrais de Produtividade e Cultura (12 meses).
  progresso("Criando 12 meses de avaliações de Produtividade e Cultura…");
  const talentosEmQueda = new Set(s.embaralhar(pessoas.filter((c) => c.area === "Tecnologia" && !novatos.some((n) => n.id === c.id))).slice(0, 2).map((c) => c.id));
  const avaliacoes = [];
  for (const c of pessoas) {
    const [p0, pd, c0, cd] = TENDENCIA[c.area] ?? [3.5, 0, 3.6, 0];
    const individual = s.ruido(0.3);
    for (let k = 0; k < 4; k++) {
      const data = diasAtras(330 - k * 90 + s.inteiro(-12, 12));
      if (I.diasEntre(c.admissao, data) < 30) continue;
      const queda = talentosEmQueda.has(c.id) && k === 3 ? -1.3 : 0;
      for (const [dim, base, passo] of [["produtividade", p0 + (talentosEmQueda.has(c.id) ? 0.4 : 0), pd], ["cultura", c0, cd]]) {
        const alvo = base + passo * k + individual + queda;
        const notas = Object.fromEntries(I.CRITERIOS[dim].map((cr) => [cr.chave, limitar(Math.round(alvo + s.ruido(0.7) - ((FRACOS[c.area] ?? []).includes(cr.chave) ? 0.6 : 0)), 1, 5)]));
        avaliacoes.push({
          empresa_id: E,
          colaborador_id: c.id,
          dimensao: dim,
          data,
          notas,
          media: Math.round(I.mediaNotas(dim, notas) * 100) / 100,
          comentario: k === 3 && s.r() < 0.25 ? s.item(["Entregas consistentes; combinar foco no que gera mais impacto.", "Evoluiu bem na comunicação com as áreas parceiras.", "Precisa de apoio para priorizar demandas concorrentes.", "Referência técnica para o time."]) : null,
          avaliador: c.gestor ?? null,
          demo: true,
        });
      }
    }
  }
  await inserirLote("bp_avaliacoes", avaliacoes, "id");

  // 3. Onboardings de quem chegou nos últimos 100 dias.
  progresso("Montando os onboardings 30/60/90…");
  const onboardings = [];
  pessoas
    .filter((c) => I.diasEntre(c.admissao, hoje) <= 100 && !store.onboardings.some((o) => o.colaborador_id === c.id))
    .forEach((c, idx) => {
      const dias = I.diasEntre(c.admissao, hoje);
      const fases = I.novasFases();
      for (const f of fases) {
        f.tarefas.forEach((t, j) => {
          const prazo = f.marco - 30 + Math.round(((j + 1) * 30) / f.tarefas.length);
          // A 2ª pessoa do grupo atrasa as duas últimas tarefas da 1ª fase.
          const atrasada = idx === 1 && f.marco === 30 && j >= f.tarefas.length - 2;
          t.feita = prazo <= dias - 2 && !atrasada;
          t.feitaEm = t.feita ? I.somarDias(c.admissao, prazo - s.inteiro(0, 3)) : null;
        });
      }
      const progressoOnb = I.progressoOnboarding(fases);
      onboardings.push({ empresa_id: E, colaborador_id: c.id, inicio: c.admissao, fases, progresso: progressoOnb, status: progressoOnb === 100 ? "concluido" : "em_andamento", demo: true });
    });
  if (onboardings.length) await inserirLote("bp_onboardings", onboardings, "id");

  // 4. Ex-colaboradores fictícios e desligamentos com entrevista.
  progresso("Registrando desligamentos e entrevistas…");
  const gestorComercial = (() => {
    const cont = new Map();
    for (const c of pessoas) if (c.area === "Comercial" && c.gestor) cont.set(c.gestor, (cont.get(c.gestor) ?? 0) + 1);
    return [...cont].sort((a, b) => b[1] - a[1])[0]?.[0] ?? pessoas.find((c) => c.area === "Comercial")?.gestor ?? null;
  })();
  const gestorDe = (area) => pessoas.find((c) => c.area === area && c.gestor)?.gestor ?? null;
  const SAIDAS = [
    { nome: "Rogério Tavares", cargo: "Executivo de Contas", area: "Comercial", gestor: gestorComercial, dias: 300, tipo: "pedido_demissao", motivo: "remuneracao" },
    { nome: "Letícia Prado", cargo: "Analista de Operações", area: "Operações", gestor: gestorDe("Operações"), dias: 240, tipo: "dispensa_sem_justa_causa", motivo: "desempenho" },
    { nome: "Marcelo Dantas", cargo: "Consultor de Vendas", area: "Comercial", gestor: gestorComercial, dias: 170, tipo: "pedido_demissao", motivo: "lideranca" },
    { nome: "Juliana Paiva", cargo: "Analista Financeira", area: "Financeiro", gestor: gestorDe("Financeiro"), dias: 110, tipo: "acordo", motivo: "crescimento" },
    { nome: "Thiago Rezende", cargo: "Desenvolvedor Back-end", area: "Tecnologia", gestor: gestorDe("Tecnologia"), dias: 60, tipo: "pedido_demissao", motivo: "proposta", lamentada: true },
    { nome: "Fernanda Queiroz", cargo: "Executiva de Contas", area: "Comercial", gestor: gestorComercial, dias: 25, tipo: "pedido_demissao", motivo: "proposta" },
  ];
  const ex = await inserirLote(
    "bp_colaboradores",
    SAIDAS.map((x) => ({ empresa_id: E, nome: x.nome, cargo: x.cargo, area: x.area, gestor: x.gestor, vinculo: "clt", salario: salarioDoCargo(x.cargo, s), admissao: diasAtras(x.dias + s.inteiro(300, 1300)), demo_original: { criado: true } })),
  );
  // Avaliações antes da saída (mais baixas nos motivos de liderança e desempenho).
  const avalEx = [];
  ex.forEach((c, i) => {
    const x = SAIDAS[i];
    for (const atras of [x.dias + 200, x.dias + 40]) {
      if (I.diasEntre(c.admissao, diasAtras(atras)) < 30) continue;
      const base = x.motivo === "desempenho" ? 2.4 : x.motivo === "lideranca" ? 3.0 : 3.5;
      for (const dim of ["produtividade", "cultura"]) {
        const notas = Object.fromEntries(I.CRITERIOS[dim].map((cr) => [cr.chave, limitar(Math.round(base + s.ruido(0.9)), 1, 5)]));
        avalEx.push({ empresa_id: E, colaborador_id: c.id, dimensao: dim, data: diasAtras(atras), notas, media: Math.round(I.mediaNotas(dim, notas) * 100) / 100, avaliador: c.gestor, demo: true });
      }
    }
  });
  if (avalEx.length) await inserirLote("bp_avaliacoes", avalEx, "id");
  for (const [i, c] of ex.entries()) {
    const x = SAIDAS[i];
    const data = diasAtras(x.dias);
    const custo = I.custoDesligamento(c, { tipo: x.tipo, data }, calc);
    const [desl] = await inserirLote("bp_desligamentos", [
      {
        empresa_id: E,
        colaborador_id: c.id,
        data,
        tipo: x.tipo,
        voluntario: I.TIPO_DESLIGAMENTO[x.tipo].voluntario,
        motivo: x.motivo,
        lamentada: Boolean(x.lamentada),
        custo: custo ? Math.round(custo.total * 100) / 100 : null,
        custo_detalhe: custo?.itens ?? null,
        checklist: I.CHECKLIST_OFFBOARDING.map((titulo) => ({ titulo, feito: true })),
        demo: true,
      },
    ]);
    const [pesq] = await inserirLote("bp_pesquisas", [
      { empresa_id: E, tipo: "offboarding", titulo: `Entrevista de desligamento · ${c.nome}`, perguntas: ENTREVISTA_DESLIGAMENTO, anonima: false, colaborador_id: c.id, status: "encerrada", demo: true, criado_em: tsDiasAtras(x.dias) },
    ]);
    const up = await supabase.from("bp_desligamentos").update({ pesquisa_id: pesq.id }).eq("id", desl.id);
    if (up.error) throw up.error;
    await inserirLote("bp_respostas", [{ empresa_id: E, pesquisa_id: pesq.id, colaborador_id: c.id, nome: c.nome, respostas: entrevista(x.motivo, s), criado_em: tsDiasAtras(x.dias - 2) }], "id");
  }

  // 5. Pulsos: Engajamento há 3 meses e Clima no mês passado.
  progresso("Respondendo as pesquisas de Pulso…");
  const mes = (dias) => new Date(`${diasAtras(dias)}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const PULSOS = [
    { tipo: "engajamento15", dias: 95, status: "encerrada", taxa: 0.72, idx: 0 },
    { tipo: "clima30", dias: 24, status: "aberta", taxa: 0.82, idx: 1 },
  ];
  for (const p of PULSOS) {
    const modelo = MODELOS[p.tipo];
    const [pesq] = await inserirLote("bp_pesquisas", [
      {
        empresa_id: E,
        tipo: p.tipo,
        titulo: `${modelo.nome} · ${mes(p.dias)}`,
        descricao: modelo.descricao,
        perguntas: modelo.perguntas,
        anonima: true,
        status: p.status,
        encerra_em: p.status === "aberta" ? I.somarDias(hoje, 6) : diasAtras(p.dias - 14),
        demo: true,
        criado_em: tsDiasAtras(p.dias),
      },
    ]);
    const respondentes = pessoas.filter((c) => I.diasEntre(c.admissao, diasAtras(p.dias)) >= 0 && s.r() < p.taxa);
    await inserirLote(
      "bp_respostas",
      respondentes.map((c) => ({
        empresa_id: E,
        pesquisa_id: pesq.id,
        area: c.area,
        respostas: respostasDe(modelo.perguntas, (CLIMA[c.area] ?? [0.6, 0.6])[p.idx], s),
        criado_em: tsDiasAtras(p.dias - s.inteiro(0, 9), s.inteiro(8, 19)),
      })),
      "id",
    );
  }

  progresso("Atualizando os indicadores…");
  sinalizarMudanca();
  await carregar();
  return { pessoas: pessoas.length, avaliacoes: avaliacoes.length + avalEx.length, onboardings: onboardings.length, desligamentos: SAIDAS.length };
}

// ─── Remover ───────────────────────────────────────────────────────────────

export async function removerDemo(progresso = () => {}) {
  const E = store.empresaId;
  const del = async (tabela, filtro) => {
    const { error } = await filtro(supabase.from(tabela).delete().eq("empresa_id", E));
    if (error) throw error;
  };
  progresso("Removendo pesquisas, desligamentos, onboardings e avaliações fictícias…");
  await del("bp_pesquisas", (q) => q.eq("demo", true));
  await del("bp_desligamentos", (q) => q.eq("demo", true));
  await del("bp_onboardings", (q) => q.eq("demo", true));
  await del("bp_avaliacoes", (q) => q.eq("demo", true));
  await del("bp_colaboradores", (q) => q.eq("demo_original->>criado", "true"));

  progresso("Devolvendo os cadastros ao estado original…");
  const { data: alterados, error } = await supabase.from("bp_colaboradores").select("id, demo_original").eq("empresa_id", E).not("demo_original", "is", null);
  if (error) throw error;
  await emParalelo(alterados, (c) => {
    const o = c.demo_original ?? {};
    return supabase.from("bp_colaboradores").update({ area: o.area ?? null, admissao: o.admissao ?? null, salario: o.salario ?? null, vinculo: o.vinculo ?? "clt", demo_original: null }).eq("id", c.id);
  });

  progresso("Limpando o histórico de demonstração…");
  await del("bp_historico", (q) => q.eq("demo", true));
  sinalizarMudanca();
  await carregar();
}
