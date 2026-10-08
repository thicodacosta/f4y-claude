/**
 * Regras e fórmulas do BP (puras). Critérios de Produtividade e Cultura vêm
 * do Feedback 1:1 do JourneyLab (journeylab/lib/feedback/avaliacao.ts),
 * separados em duas avaliações; fórmulas de turnover seguem o People
 * Analytics (journeylab/lib/analytics/calculo.ts); o risco de saída adapta
 * journeylab/lib/retencao-talentos/risco.ts aos dados do BP.
 */

const DIA = 86_400_000;

// ─── Datas (civis, "AAAA-MM-DD") ───────────────────────────────────────────

export const hojeISO = () => new Date().toLocaleDateString("sv-SE");
export const paraData = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`) : null);
export const diasEntre = (a, b) => Math.round((paraData(b) - paraData(a)) / DIA);
export const somarDias = (iso, dias) => new Date(paraData(iso).getTime() + dias * DIA).toLocaleDateString("sv-SE");
export const fmtData = (iso) => (iso ? paraData(iso).toLocaleDateString("pt-BR") : "—");
export const fmtDataHora = (ts) => new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const umaCasa = (n) => (n == null || Number.isNaN(n) ? "—" : Number(n).toFixed(1).replace(".", ","));
export const pct = (n, casas = 0) => (n == null || Number.isNaN(n) ? "—" : `${Number(n).toFixed(casas).replace(".", ",")}%`);
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const rotuloMes = (chave) => {
  const [a, m] = chave.split("-");
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
};
export const chaveMes = (iso) => String(iso).slice(0, 7);

/** Últimos `n` meses (inclui o atual), do mais antigo ao mais recente. */
export function ultimosMeses(n, base = hojeISO()) {
  const d = paraData(base);
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });
}
/** Próximos `n` meses depois do atual. */
export function proximosMeses(n, base = hojeISO()) {
  const d = paraData(base);
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() + 1 + i, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });
}
const fimDoMes = (chave) => {
  const [a, m] = chave.split("-").map(Number);
  return new Date(a, m, 0).toLocaleDateString("sv-SE");
};

export const mesesDeCasa = (c, ate = hojeISO()) => (c.admissao ? Math.max(0, Math.floor(diasEntre(c.admissao, c.desligamento ?? ate) / 30.44)) : null);
export const tempoDeCasa = (c) => {
  const m = mesesDeCasa(c);
  if (m == null) return "—";
  if (m < 12) return `${m} ${m === 1 ? "mês" : "meses"}`;
  const a = Math.floor(m / 12);
  return `${a} ${a === 1 ? "ano" : "anos"}${m % 12 ? ` e ${m % 12} m` : ""}`;
};

// ─── Critérios de Produtividade e Cultura ──────────────────────────────────

export const CRITERIOS = {
  produtividade: [
    { chave: "produtividade", nome: "Produtividade", descricao: "Volume e constância das entregas.", foco: "Aumentar a constância e o volume de entregas" },
    { chave: "qualidade", nome: "Qualidade nas entregas", descricao: "Precisão, cuidado e retrabalho.", foco: "Elevar a qualidade das entregas e reduzir retrabalho" },
    { chave: "ferramentas", nome: "Ferramentas e sistemas", descricao: "Domínio das ferramentas do trabalho.", foco: "Dominar as ferramentas e sistemas da função" },
    { chave: "priorizacao", nome: "Capacidade de priorização", descricao: "Foco no que gera mais impacto.", foco: "Priorizar demandas pelo impacto" },
    { chave: "tempo", nome: "Gestão do tempo", descricao: "Prazos e organização da agenda.", foco: "Organizar a agenda e cumprir prazos" },
    { chave: "aprendizado", nome: "Estudo e aprendizado", descricao: "Busca ativa por desenvolvimento.", foco: "Criar rotina de estudo e aprendizado" },
    { chave: "relacionamento", nome: "Relacionamento", descricao: "Interação com time, pares e áreas.", foco: "Fortalecer o relacionamento com time e áreas parceiras" },
    { chave: "comunicacao", nome: "Comunicação", descricao: "Clareza e momento certo de comunicar.", foco: "Comunicar com mais clareza e no momento certo" },
  ],
  cultura: [
    { chave: "criatividade", nome: "Criatividade", descricao: "Novas ideias e soluções.", foco: "Propor e testar novas soluções" },
    { chave: "confianca", nome: "Confiança", descricao: "Transparência e cumprimento de acordos.", foco: "Fortalecer a confiança com transparência e acordos cumpridos" },
    { chave: "resultado", nome: "Compromisso com o resultado", descricao: "Foco no objetivo final.", foco: "Conectar as entregas aos resultados esperados" },
    { chave: "sensoDono", nome: "Senso de dono", descricao: "Responsabilidade além do escopo.", foco: "Assumir responsabilidade de ponta a ponta" },
    { chave: "adaptabilidade", nome: "Adaptabilidade", descricao: "Lidar bem com mudanças.", foco: "Lidar melhor com mudanças de contexto" },
    { chave: "resiliencia", nome: "Resiliência", descricao: "Seguir em frente diante de obstáculos.", foco: "Desenvolver resiliência diante de obstáculos" },
    { chave: "longoPrazo", nome: "Visão de longo prazo", descricao: "Decisões que consideram o futuro.", foco: "Considerar o longo prazo nas decisões" },
    { chave: "colaboracao", nome: "Colaboração", descricao: "Ajudar e somar com o time.", foco: "Colaborar mais ativamente com o time" },
  ],
};

export const ESCALA = { 1: "Muito abaixo", 2: "Abaixo", 3: "Atende", 4: "Acima", 5: "Supera" };

export function mediaNotas(dimensao, notas) {
  const lista = CRITERIOS[dimensao];
  if (!lista.every((c) => Number.isInteger(notas[c.chave]) && notas[c.chave] >= 1 && notas[c.chave] <= 5)) return null;
  return lista.reduce((s, c) => s + notas[c.chave], 0) / lista.length;
}

/** Semáforo pela média (mesma régua do Feedback 1:1). */
export function semaforo(media) {
  if (media == null) return { nome: "Sem avaliação", tom: "neutro" };
  if (media >= 4) return { nome: "Bom", tom: "sucesso" };
  if (media >= 3) return { nome: "Acompanhar", tom: "alerta" };
  return { nome: "Atenção", tom: "perigo" };
}

/** Avaliações de uma pessoa numa dimensão, da mais recente à mais antiga. */
export const avaliacoesDe = (avaliacoes, colabId, dimensao) => avaliacoes.filter((a) => a.colaborador_id === colabId && a.dimensao === dimensao);

/** Última avaliação de cada pessoa ativa numa dimensão. */
export function ultimasPorPessoa(avaliacoes, colaboradores, dimensao) {
  const ids = new Set(colaboradores.filter((c) => c.status === "ativo").map((c) => c.id));
  const mapa = new Map();
  for (const a of avaliacoes) if (a.dimensao === dimensao && ids.has(a.colaborador_id) && !mapa.has(a.colaborador_id)) mapa.set(a.colaborador_id, a);
  return mapa;
}

/** Média por critério na última avaliação de cada pessoa ativa. */
export function mediaPorCriterio(avaliacoes, colaboradores, dimensao) {
  const ultimas = [...ultimasPorPessoa(avaliacoes, colaboradores, dimensao).values()];
  return CRITERIOS[dimensao].map((c) => {
    const notas = ultimas.map((a) => a.notas?.[c.chave]).filter((n) => typeof n === "number");
    return { ...c, media: notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null };
  });
}

// ─── Onboarding 30/60/90 (modelo do JourneyLab) ────────────────────────────

export const MODELO_ONBOARDING = [
  {
    titulo: "Boas-vindas e cultura",
    marco: 30,
    tarefas: [
      ["Apresentação da empresa e da cultura", "rh"],
      ["Configuração de e-mail, sistemas e acessos", "rh"],
      ["Reunião de alinhamento com o gestor direto", "gestor"],
      ["Apresentação ao time e às áreas parceiras", "gestor"],
      ["Leitura das políticas e do código de conduta", "colaborador"],
    ],
  },
  {
    titulo: "Processos e expectativas",
    marco: 60,
    tarefas: [
      ["Entender os processos e indicadores da área", "gestor"],
      ["Participar dos rituais do time", "colaborador"],
      ["Primeira entrega supervisionada", "colaborador"],
      ["Feedback intermediário (dia 45)", "gestor"],
    ],
  },
  {
    titulo: "Consolidação",
    marco: 90,
    tarefas: [
      ["Definição de metas do próximo trimestre", "gestor"],
      ["Projeto ou entrega independente", "colaborador"],
      ["Avaliação final do onboarding", "rh"],
    ],
  },
];

export const RESPONSAVEL = { rh: "RH", gestor: "Gestor", colaborador: "Colaborador" };

export function novasFases() {
  return MODELO_ONBOARDING.map((f, i) => ({
    id: `f${i + 1}`,
    titulo: f.titulo,
    marco: f.marco,
    tarefas: f.tarefas.map(([titulo, responsavel], j) => ({ id: `f${i + 1}t${j + 1}`, titulo, responsavel, feita: false, feitaEm: null })),
  }));
}

export function progressoOnboarding(fases) {
  const tarefas = fases.flatMap((f) => f.tarefas);
  if (!tarefas.length) return 0;
  return Math.round((tarefas.filter((t) => t.feita).length / tarefas.length) * 100);
}

/** Situação de cada fase: concluída, atrasada (marco vencido com tarefas abertas), em andamento ou futura. */
export function situacaoFase(onb, fase, hoje = hojeISO()) {
  const abertas = fase.tarefas.filter((t) => !t.feita).length;
  if (!abertas) return { nome: "Concluída", tom: "sucesso" };
  const prazo = somarDias(onb.inicio, fase.marco);
  if (prazo < hoje) return { nome: `Atrasada (marco ${fmtData(prazo)})`, tom: "perigo" };
  const inicioFase = somarDias(onb.inicio, fase.marco - 30);
  if (inicioFase <= hoje) return { nome: `Em andamento até ${fmtData(prazo)}`, tom: "alerta" };
  return { nome: `A partir de ${fmtData(inicioFase)}`, tom: "neutro" };
}

export const onboardingAtrasado = (onb, hoje = hojeISO()) =>
  onb.status === "em_andamento" && onb.fases.some((f) => situacaoFase(onb, f, hoje).tom === "perigo");

export const diaDoOnboarding = (onb, hoje = hojeISO()) => Math.max(0, diasEntre(onb.inicio, hoje));

// ─── Desligamento (Offboarding / Turnover) ─────────────────────────────────

export const TIPO_DESLIGAMENTO = {
  pedido_demissao: { nome: "Pedido de demissão", voluntario: true },
  dispensa_sem_justa_causa: { nome: "Dispensa sem justa causa", voluntario: false },
  dispensa_justa_causa: { nome: "Dispensa por justa causa", voluntario: false },
  acordo: { nome: "Acordo entre as partes", voluntario: true },
  termino_contrato: { nome: "Término de contrato", voluntario: false },
  aposentadoria: { nome: "Aposentadoria", voluntario: true },
  outro: { nome: "Outro", voluntario: false },
};

export const MOTIVOS = {
  remuneracao: "Remuneração e benefícios",
  crescimento: "Crescimento e carreira",
  lideranca: "Liderança direta",
  cultura: "Cultura e ambiente",
  carga: "Carga de trabalho e equilíbrio",
  reconhecimento: "Reconhecimento",
  proposta: "Proposta de outra empresa",
  flexibilidade: "Modelo de trabalho e flexibilidade",
  pessoal: "Motivos pessoais",
  desempenho: "Desempenho ou comportamento",
  reestruturacao: "Reestruturação ou redução",
  outro: "Outro motivo",
};

export const CHECKLIST_OFFBOARDING = [
  "Comunicação formal do desligamento",
  "Revogação de acessos e sistemas",
  "Devolução de equipamentos",
  "Transferência de conhecimento e pendências",
  "Cálculo e pagamento das verbas rescisórias",
  "Entrevista de desligamento",
  "Comunicação ao time e aos clientes",
];

/**
 * Custo estimado de um desligamento: verbas (CLT na dispensa sem justa causa;
 * PJ sem multa informada) + reposição (premissas padrão da calculadora da
 * ToolsKit: recrutamento = 1 salário, treinamento = 0,5, 45 dias de vaga
 * aberta e 3 meses de rampa a 50%). Estimativa para gestão, não cálculo
 * trabalhista.
 */
export function custoDesligamento(c, desl, calc) {
  const salario = Number(c.salario) || 0;
  if (!salario) return null;
  const itens = [];
  const sem = desl.tipo === "dispensa_sem_justa_causa" || desl.tipo === "acordo";
  if (c.vinculo === "clt" && sem && c.admissao) {
    const verbas = calc.cltTermination({ salario, admissao: paraData(c.admissao), desligamento: paraData(desl.data) });
    // No acordo (art. 484-A), aviso e multa caem pela metade.
    for (const i of verbas.itens) itens.push(desl.tipo === "acordo" && /Aviso|Multa/.test(i.rotulo) ? { ...i, rotulo: `${i.rotulo} · acordo (50%)`, valor: i.valor / 2 } : i);
  }
  const custoMensal = c.vinculo === "clt" ? salario * calc.DEFAULT_CLT_COST_FACTOR : salario;
  itens.push(...calc.replacementCosts({ custoMensal, recrutamento: salario, treinamento: salario * 0.5, diasVagaAberta: 45, mesesRampa: 3 }));
  return { itens, total: calc.sum(itens) };
}

// ─── Quadro e turnover ─────────────────────────────────────────────────────

const ativoEm = (c, dia) => c.admissao && c.admissao <= dia && (!c.desligamento || c.desligamento > dia);
export const headcountEm = (colabs, dia) => colabs.reduce((n, c) => n + (ativoEm(c, dia) ? 1 : 0), 0);

/** Turnover de um período: saídas ÷ headcount médio × 100. */
export function turnoverPeriodo(colabs, desligs, inicio, fim, filtro = () => true) {
  const saidas = desligs.filter((d) => d.data >= inicio && d.data <= fim && filtro(d));
  const hcMedio = (headcountEm(colabs, inicio) + headcountEm(colabs, fim)) / 2;
  return { saidas: saidas.length, hcMedio, taxa: hcMedio ? (saidas.length / hcMedio) * 100 : null };
}

/** Série mensal (últimos `n` meses) dos indicadores de pessoas. */
export function serieMensal({ colaboradores, desligamentos, avaliacoes }, n = 12) {
  return ultimosMeses(n).map((mes) => {
    const fim = fimDoMes(mes);
    const ini = `${mes}-01`;
    const hc = headcountEm(colaboradores, fim);
    const hcIni = headcountEm(colaboradores, somarDias(ini, -1));
    const saidas = desligamentos.filter((d) => chaveMes(d.data) === mes);
    const admissoes = colaboradores.filter((c) => c.admissao && chaveMes(c.admissao) === mes).length;
    const hcMedio = (hc + hcIni) / 2;
    const media = (dim) => {
      const notas = avaliacoes.filter((a) => a.dimensao === dim && chaveMes(a.data) === mes).map((a) => Number(a.media));
      return notas.length ? notas.reduce((s, x) => s + x, 0) / notas.length : null;
    };
    return {
      mes,
      headcount: hc,
      admissoes,
      saidas: saidas.length,
      voluntarias: saidas.filter((d) => d.voluntario).length,
      turnover: hcMedio ? (saidas.length / hcMedio) * 100 : 0,
      produtividade: media("produtividade"),
      cultura: media("cultura"),
    };
  });
}

// ─── Projeção (análise preditiva) ──────────────────────────────────────────

/** Mínimos quadrados sobre os pontos não nulos: { inclinacao, intercepto, r2 }. */
export function regressao(valores) {
  const pts = valores.map((y, x) => [x, y]).filter(([, y]) => y != null && !Number.isNaN(y));
  if (pts.length < 2) return null;
  const n = pts.length;
  const mx = pts.reduce((s, [x]) => s + x, 0) / n;
  const my = pts.reduce((s, [, y]) => s + y, 0) / n;
  const sxx = pts.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  const sxy = pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
  const inclinacao = sxx ? sxy / sxx : 0;
  const intercepto = my - inclinacao * mx;
  const sst = pts.reduce((s, [, y]) => s + (y - my) ** 2, 0);
  const sse = pts.reduce((s, [x, y]) => s + (y - (intercepto + inclinacao * x)) ** 2, 0);
  return { inclinacao, intercepto, r2: sst ? 1 - sse / sst : 1, n };
}

/** Projeta `k` pontos à frente pela tendência (limitada a [min, max]). */
export function projetar(valores, k, { min = -Infinity, max = Infinity } = {}) {
  const r = regressao(valores);
  if (!r) return null;
  const base = valores.length;
  return Array.from({ length: k }, (_, i) => Math.min(max, Math.max(min, r.intercepto + r.inclinacao * (base + i))));
}

// Referência de mercado quando não há histórico de saídas: ~1,5% ao mês.
export const TAXA_MENSAL_REFERENCIA = 0.015;
const MULTIPLICADOR_RISCO = { alto: 2.5, medio: 1.4, baixo: 0.6 };

/**
 * Risco de saída — INDICATIVO, para priorizar conversas e ações (nunca para
 * decidir sobre a pessoa). Cada fator aparece por escrito.
 *
 *  +15 primeiros 6 meses de casa (+10 entre 6 e 12)
 *  +20 última Produtividade < 3 (+10 abaixo de 3,5)
 *  +20 última Cultura < 3 (+10 abaixo de 3,5)
 *  +10 queda de 0,5 ponto ou mais entre as duas últimas avaliações (cada dimensão)
 *  +10 sem avaliação há mais de 120 dias (ou nunca, com mais de 90 dias de casa)
 *  + 8 onboarding com fase atrasada
 *  +12 gestor com 2 ou mais saídas voluntárias em 12 meses
 *  + 8 área com turnover voluntário ≥ 20% em 12 meses
 *  + 8 área com favorabilidade < 50% no último Pulso (mín. 3 respostas)
 *  Nível: alto ≥ 45 · médio 25–44 · baixo < 25 (máx. 100)
 */
export function riscos({ colaboradores, avaliacoes, onboardings, desligamentos }, favorabilidadePorArea = new Map(), hoje = hojeISO()) {
  const ha12m = somarDias(hoje, -365);
  const saidas12 = desligamentos.filter((d) => d.data >= ha12m && d.voluntario);
  const porGestor = new Map();
  const porArea = new Map();
  for (const d of saidas12) {
    const c = colaboradores.find((x) => x.id === d.colaborador_id);
    if (c?.gestor) porGestor.set(c.gestor, (porGestor.get(c.gestor) ?? 0) + 1);
    if (c?.area) porArea.set(c.area, (porArea.get(c.area) ?? 0) + 1);
  }
  const ativos = colaboradores.filter((c) => c.status === "ativo");
  const hcArea = new Map();
  for (const c of ativos) if (c.area) hcArea.set(c.area, (hcArea.get(c.area) ?? 0) + 1);

  return ativos
    .map((c) => {
      const fatores = [];
      const dias = c.admissao ? diasEntre(c.admissao, hoje) : null;
      if (dias != null && dias < 183) fatores.push({ texto: "Primeiros 6 meses de casa", pontos: 15 });
      else if (dias != null && dias < 365) fatores.push({ texto: "Primeiro ano de casa", pontos: 10 });

      let ultimaData = null;
      for (const dim of ["produtividade", "cultura"]) {
        const [u, ant] = avaliacoesDe(avaliacoes, c.id, dim);
        const nome = dim === "produtividade" ? "Produtividade" : "Cultura";
        if (u) {
          if (!ultimaData || u.data > ultimaData) ultimaData = u.data;
          if (Number(u.media) < 3) fatores.push({ texto: `${nome} abaixo do esperado (${umaCasa(u.media)})`, pontos: 20 });
          else if (Number(u.media) < 3.5) fatores.push({ texto: `${nome} no limite (${umaCasa(u.media)})`, pontos: 10 });
          if (ant && Number(ant.media) - Number(u.media) >= 0.5) fatores.push({ texto: `Queda em ${nome} (${umaCasa(ant.media)} → ${umaCasa(u.media)})`, pontos: 10 });
        }
      }
      if (ultimaData ? diasEntre(ultimaData, hoje) > 120 : dias != null && dias > 90) {
        fatores.push({ texto: ultimaData ? "Sem avaliação há mais de 120 dias" : "Nunca avaliado(a)", pontos: 10 });
      }
      if (onboardings.some((o) => o.colaborador_id === c.id && onboardingAtrasado(o, hoje))) fatores.push({ texto: "Onboarding com fase atrasada", pontos: 8 });
      if (c.gestor && (porGestor.get(c.gestor) ?? 0) >= 2) fatores.push({ texto: `Gestor(a) com ${porGestor.get(c.gestor)} saídas voluntárias em 12 meses`, pontos: 12 });
      if (c.area && hcArea.get(c.area) && ((porArea.get(c.area) ?? 0) / (hcArea.get(c.area) + (porArea.get(c.area) ?? 0))) * 100 >= 20) {
        fatores.push({ texto: `Área ${c.area} com turnover voluntário ≥ 20%`, pontos: 8 });
      }
      const fav = c.area ? favorabilidadePorArea.get(c.area) : null;
      if (fav != null && fav < 50) fatores.push({ texto: `Clima da área ${c.area} com favorabilidade ${pct(fav)}`, pontos: 8 });

      const pontos = Math.min(100, fatores.reduce((s, f) => s + f.pontos, 0));
      const nivel = pontos >= 45 ? "alto" : pontos >= 25 ? "medio" : "baixo";
      return { colaborador: c, pontos, nivel, fatores };
    })
    .sort((a, b) => b.pontos - a.pontos);
}

export const NIVEL = { alto: { nome: "Risco alto", tom: "perigo" }, medio: { nome: "Risco médio", tom: "alerta" }, baixo: { nome: "Risco baixo", tom: "sucesso" } };

/**
 * Previsão de saídas: taxa mensal histórica (12 meses) ajustada pelo risco de
 * cada pessoa. Saídas esperadas em `meses` = Σ 1 − (1 − p)^meses.
 */
export function saidasEsperadas(listaRiscos, taxaMensal, meses = 3) {
  const base = taxaMensal > 0 ? taxaMensal : TAXA_MENSAL_REFERENCIA;
  return listaRiscos.reduce((s, r) => {
    const p = Math.min(0.5, base * MULTIPLICADOR_RISCO[r.nivel]);
    return s + (1 - (1 - p) ** meses);
  }, 0);
}

// ─── Pulso: agregação ──────────────────────────────────────────────────────

/** Valor numérico de uma resposta (1–5 nas escalas; 0–10 no NPS). */
export function valorNumerico(pergunta, resposta) {
  if (resposta == null || resposta === "") return null;
  if (["likert", "escala", "nps"].includes(pergunta.tipo)) return Number(resposta);
  if (pergunta.tipo === "escolha") return pergunta.opcoes?.find((o) => o.id === resposta)?.valor ?? null;
  if (pergunta.tipo === "simnao") return resposta === "sim" ? 5 : resposta === "nao" ? 1 : null;
  return null;
}

/** Favorabilidade (0–100) de uma lista de valores 1–5: % de 4 e 5. */
const favoravel = (vals) => (vals.length ? (vals.filter((v) => v >= 4).length / vals.length) * 100 : null);
export const enps = (notas) => (notas.length ? Math.round(((notas.filter((n) => n >= 9).length - notas.filter((n) => n <= 6).length) / notas.length) * 100) : null);

/** Resultado de uma pesquisa: por pergunta, por dimensão, eNPS e comentários. */
export function resultadoPesquisa(pesquisa, lista) {
  const porPergunta = pesquisa.perguntas.map((p) => {
    const brutas = lista.map((r) => r.respostas?.[p.id]).filter((v) => v != null && v !== "" && !(Array.isArray(v) && !v.length));
    const base = { pergunta: p, total: brutas.length };
    if (p.tipo === "nps") return { ...base, enps: enps(brutas.map(Number)), media: brutas.length ? brutas.reduce((s, v) => s + Number(v), 0) / brutas.length : null };
    if (p.tipo === "texto") return { ...base, textos: brutas.map(String) };
    if (p.tipo === "multipla" || p.tipo === "escolha" || p.tipo === "simnao") {
      const opcoes = p.tipo === "simnao" ? [{ id: "sim", rotulo: "Sim" }, { id: "nao", rotulo: "Não" }] : p.opcoes;
      const contagem = opcoes.map((o) => ({ ...o, n: brutas.filter((v) => (Array.isArray(v) ? v.includes(o.id) : v === o.id)).length }));
      const vals = brutas.map((v) => valorNumerico(p, v)).filter((v) => v != null);
      return { ...base, contagem, favorabilidade: p.tipo === "multipla" ? null : favoravel(vals), media: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null };
    }
    const vals = brutas.map(Number);
    return {
      ...base,
      media: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
      favorabilidade: favoravel(vals),
      distribuicao: [1, 2, 3, 4, 5].map((n) => vals.filter((v) => v === n).length),
    };
  });

  const dims = new Map();
  for (const r of porPergunta) {
    if (r.favorabilidade == null || !r.pergunta.dimensao) continue;
    const d = dims.get(r.pergunta.dimensao) ?? [];
    d.push(r.favorabilidade);
    dims.set(r.pergunta.dimensao, d);
  }
  const dimensoes = [...dims].map(([nome, v]) => ({ nome, favorabilidade: v.reduce((s, x) => s + x, 0) / v.length })).sort((a, b) => b.favorabilidade - a.favorabilidade);
  const favs = porPergunta.map((r) => r.favorabilidade).filter((v) => v != null);
  const npsQ = porPergunta.find((r) => r.pergunta.tipo === "nps");
  return {
    total: lista.length,
    porPergunta,
    dimensoes,
    favorabilidade: favs.length ? favs.reduce((s, x) => s + x, 0) / favs.length : null,
    enps: npsQ?.enps ?? null,
    comentarios: porPergunta.filter((r) => r.textos?.length).flatMap((r) => r.textos.map((t) => ({ pergunta: r.pergunta.texto, texto: t }))),
  };
}

// Recortes por área só com pelo menos 3 respostas (protege o anonimato).
export const MINIMO_RECORTE = 3;

export function favorabilidadePorArea(pesquisa, lista) {
  const grupos = new Map();
  for (const r of lista) if (r.area) grupos.set(r.area, [...(grupos.get(r.area) ?? []), r]);
  const mapa = new Map();
  for (const [area, rs] of grupos) if (rs.length >= MINIMO_RECORTE) mapa.set(area, resultadoPesquisa(pesquisa, rs).favorabilidade);
  return mapa;
}
