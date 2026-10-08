/**
 * Números da aba Gestão a partir do histórico de atividades (atividades.js):
 * filtros, indicadores, série no tempo e o "relatório" no formato usado pelo
 * Motion da extensão BP (extensao-bp/src/core/relatorio.js):
 * { modulo, titulo, subtitulo, kpis, graficos, tabelas, destaques }.
 */
import { TIPOS } from "../atividades.js";

const DIA = 86_400_000;

export const PERIODOS = {
  7: "Últimos 7 dias",
  30: "Últimos 30 dias",
  90: "Últimos 90 dias",
  365: "Últimos 12 meses",
  tudo: "Todo o histórico",
  personalizado: "Personalizado",
};

const inicioDoDia = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Intervalo [de, ate] em ms para os filtros escolhidos. */
export function intervalo({ periodo, de, ate }, eventos = []) {
  const agora = Date.now();
  if (periodo === "personalizado") {
    const ini = de ? new Date(`${de}T00:00:00`).getTime() : eventos[0]?.em ?? agora;
    const fim = ate ? new Date(`${ate}T23:59:59`).getTime() : agora;
    return { de: ini, ate: fim };
  }
  if (periodo === "tudo") return { de: eventos.length ? inicioDoDia(Math.min(...eventos.map((e) => e.em))) : inicioDoDia(agora), ate: agora };
  return { de: inicioDoDia(agora - (Number(periodo) - 1) * DIA), ate: agora };
}

export function filtrar(eventos, filtros) {
  const { de, ate } = intervalo(filtros, eventos);
  return eventos.filter((e) => e.em >= de && e.em <= ate && (!filtros.tipo || filtros.tipo === "todos" || e.tipo === filtros.tipo));
}

const soma = (lista, campo) => lista.reduce((s, e) => s + (Number(e.dados?.[campo]) || 0), 0);

/** Indicadores do período. */
export function indicadores(eventos) {
  const por = (tipo) => eventos.filter((e) => e.tipo === tipo);
  const entrevistas = por("entrevista");
  const comparativos = por("comparativo");
  const shortlists = por("shortlist");
  return {
    total: eventos.length,
    entrevistas: entrevistas.length,
    minutosEntrevista: Math.round(soma(entrevistas, "duracaoMin")),
    curriculos: por("curriculo").length,
    curriculosBaixados: por("curriculo_download").length,
    comparativos: comparativos.length,
    candidatosComparados: soma(comparativos, "candidatos"),
    shortlists: shortlists.length,
    candidatosEncontrados: soma(shortlists, "encontrados"),
    perfisAnalisados: soma(shortlists, "analisados"),
    salarios: por("salario").length,
    traducoes: por("traducao").length,
    pdfs: por("pdf_registro").length,
    chat: por("chat").length,
    prompts: por("prompt").length,
  };
}

export const horas = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`);

/** Agrupamento do gráfico: por dia até 31 dias, por semana até 120, senão por mês. */
export function serie(eventos, { de, ate }) {
  const dias = Math.max(1, Math.round((ate - de) / DIA));
  const modo = dias <= 31 ? "dia" : dias <= 120 ? "semana" : "mes";
  const baldes = [];
  let cursor = new Date(inicioDoDia(de));
  if (modo === "semana") cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7)); // segunda-feira
  if (modo === "mes") cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  while (cursor.getTime() <= ate) {
    const ini = cursor.getTime();
    const prox = new Date(cursor);
    if (modo === "dia") prox.setDate(prox.getDate() + 1);
    if (modo === "semana") prox.setDate(prox.getDate() + 7);
    if (modo === "mes") prox.setMonth(prox.getMonth() + 1);
    const rotulo =
      modo === "mes"
        ? cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "")
        : cursor.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    baldes.push({ rotulo, ini, fim: prox.getTime(), valor: 0 });
    cursor = prox;
  }
  for (const e of eventos) {
    const b = baldes.find((x) => e.em >= x.ini && e.em < x.fim);
    if (b) b.valor += 1;
  }
  return { modo, itens: baldes };
}

/** Quantidade por funcionalidade, da maior para a menor. */
export function porTipo(eventos) {
  return Object.keys(TIPOS)
    .map((tipo) => ({ tipo, rotulo: TIPOS[tipo].rotulo, valor: eventos.filter((e) => e.tipo === tipo).length }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor);
}

/** Linha do histórico em texto: o que foi feito, com o detalhe principal. */
export function descrever(e) {
  const d = e.dados ?? {};
  switch (e.tipo) {
    case "entrevista":
      return [d.candidato || "Candidato não informado", d.vaga, d.duracaoMin ? horas(Math.round(d.duracaoMin)) : null, d.origem === "colada" ? "transcrição colada" : null]
        .filter(Boolean)
        .join(" · ");
    case "traducao":
      return [d.candidato, d.idioma === "es" ? "espanhol" : d.idioma === "en" ? "inglês" : d.idioma].filter(Boolean).join(" · ");
    case "pdf_registro":
      return [d.candidato, d.idioma && d.idioma !== "pt" ? d.idioma.toUpperCase() : null].filter(Boolean).join(" · ");
    case "curriculo":
      return [d.candidato, d.titulo].filter(Boolean).join(" · ");
    case "curriculo_download":
      return [d.candidato, d.formato?.toUpperCase(), d.cargo].filter(Boolean).join(" · ");
    case "comparativo":
      return [d.vaga, d.candidatos ? `${d.candidatos} candidatos` : null, d.melhor != null ? `melhor: ${d.melhor}%` : null].filter(Boolean).join(" · ");
    case "salario":
      return [d.cargo, d.senioridade, d.local].filter(Boolean).join(" · ");
    case "shortlist":
      return [d.vaga, `${d.encontrados ?? 0} de ${d.pedidos ?? 0} candidatos`, d.analisados ? `${d.analisados} perfis analisados` : null, d.finalizada ? "finalizada antes" : null]
        .filter(Boolean)
        .join(" · ");
    case "prompt":
      return d.titulo ?? "";
    default:
      return "";
  }
}

export const dataHora = (ms) =>
  new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Relatório do período (formato do Motion da BP), também usado no PDF. */
export function relatorio(eventos, filtros, { empresa = "" } = {}) {
  const faixa = intervalo(filtros, eventos);
  const lista = filtrar(eventos, filtros);
  const k = indicadores(lista);
  const s = serie(lista, faixa);
  const tipos = porTipo(lista);
  const periodo =
    filtros.periodo === "personalizado" || filtros.periodo === "tudo"
      ? `${new Date(faixa.de).toLocaleDateString("pt-BR")} a ${new Date(faixa.ate).toLocaleDateString("pt-BR")}`
      : PERIODOS[filtros.periodo];
  const filtroTipo = filtros.tipo && filtros.tipo !== "todos" ? ` · ${TIPOS[filtros.tipo]?.rotulo}` : "";

  const kpis = [
    { rotulo: "Entrevistas transcritas", valor: String(k.entrevistas), detalhe: k.minutosEntrevista ? `${horas(k.minutosEntrevista)} de entrevista` : null },
    { rotulo: "Currículos padronizados", valor: String(k.curriculos), detalhe: k.curriculosBaixados ? `${k.curriculosBaixados} downloads` : null },
    { rotulo: "Comparativos", valor: String(k.comparativos), detalhe: k.candidatosComparados ? `${k.candidatosComparados} candidatos comparados` : null },
    { rotulo: "Shortlists", valor: String(k.shortlists), detalhe: k.candidatosEncontrados ? `${k.candidatosEncontrados} candidatos encontrados` : null },
    { rotulo: "Pesquisas salariais", valor: String(k.salarios), detalhe: null },
    { rotulo: "Registros traduzidos", valor: String(k.traducoes), detalhe: null },
    { rotulo: "Perguntas no Chat", valor: String(k.chat), detalhe: null },
    { rotulo: "Prompts usados", valor: String(k.prompts), detalhe: null },
  ];

  const destaques = [];
  if (k.total === 0) destaques.push("Nenhuma atividade registrada no período.");
  if (tipos[0]) destaques.push(`Funcionalidade mais usada: ${tipos[0].rotulo.toLowerCase()} (${tipos[0].valor}).`);
  if (k.entrevistas) destaques.push(`${k.entrevistas} entrevista(s) estruturada(s) em registro${k.minutosEntrevista ? `, somando ${horas(k.minutosEntrevista)} de conversa` : ""}.`);
  if (k.shortlists) destaques.push(`${k.candidatosEncontrados} candidato(s) aderente(s) identificado(s) em ${k.shortlists} Shortlist(s), entre ${k.perfisAnalisados} perfis analisados.`);
  if (k.comparativos) destaques.push(`${k.candidatosComparados} candidato(s) comparado(s) frente às vagas em ${k.comparativos} comparativo(s).`);
  const pico = [...s.itens].sort((a, b) => b.valor - a.valor)[0];
  if (pico?.valor) destaques.push(`Pico de atividade: ${pico.rotulo} (${pico.valor} ações).`);

  return {
    modulo: "gestao",
    titulo: "Gestão do recrutador",
    subtitulo: `${empresa ? `${empresa} · ` : ""}${periodo}${filtroTipo}`,
    periodo: faixa,
    kpis,
    graficos: [
      {
        titulo: `Atividades por ${s.modo === "dia" ? "dia" : s.modo === "semana" ? "semana" : "mês"}`,
        tipo: "colunas",
        itens: s.itens.map((i) => ({ rotulo: i.rotulo, valor: i.valor })),
        casas: 0,
      },
      { titulo: "Atividades por funcionalidade", tipo: "barras", itens: tipos.map((t) => ({ rotulo: t.rotulo, valor: t.valor })), casas: 0 },
    ],
    tabelas: [
      {
        titulo: "Histórico",
        colunas: ["Data", "Atividade", "Detalhe"],
        linhas: [...lista].sort((a, b) => b.em - a.em).map((e) => [dataHora(e.em), TIPOS[e.tipo]?.singular ?? e.tipo, descrever(e)]),
      },
    ],
    destaques,
    indicadores: k,
  };
}
