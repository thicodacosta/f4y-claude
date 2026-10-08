/**
 * Aba "Gestão": painel com tudo o que o recrutador fez na plataforma
 * (entrevistas, currículos, comparativos, Shortlists, pesquisas…), com
 * filtros de período e de funcionalidade, histórico, PDF e Motion.
 *
 * O Motion reaproveita o motor e o roteirista da extensão BP
 * (extensao-bp/src/motion): a IA escreve o roteiro a partir do relatório do
 * período e a página motion.html toca e exporta o vídeo.
 */
import { listarAtividades, TIPOS } from "../atividades.js";
import { FriendlyError } from "../errors.js";
import { $, el, saveBlob, showError } from "../ui.js";
import { OPCOES } from "../../../extensao-bp/src/motion/opcoes.js";
import { PERIODOS, dataHora, descrever, filtrar, horas, indicadores, intervalo, porTipo, relatorio, serie } from "./dados.js";

const PAGINA = 40;
let eventos = [];
let mostrar = PAGINA;
let getKeys = () => ({});

const filtros = () => ({
  periodo: $("ges-periodo").value,
  de: $("ges-de").value,
  ate: $("ges-ate").value,
  tipo: $("ges-tipo").value,
});

async function empresa() {
  return (await chrome.storage.local.get("branding")).branding?.empresa ?? "";
}

// ---- Gráficos (SVG) ------------------------------------------------------------

const SVG = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

function graficoColunas(itens, legenda) {
  const W = 320;
  const H = 120;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  const slot = W / Math.max(itens.length, 1);
  const larg = Math.max(2, Math.min(18, slot - 3));
  const root = svg("svg", { viewBox: `0 0 ${W} ${H + 18}`, class: "ges-chart", role: "img", "aria-label": legenda });
  root.append(svg("line", { x1: 0, y1: H, x2: W, y2: H, class: "ges-chart__eixo" }));
  const passo = Math.ceil(itens.length / 8);
  itens.forEach((it, i) => {
    const h = (it.valor / max) * (H - 14);
    const x = i * slot + (slot - larg) / 2;
    if (h > 0) {
      const r = svg("rect", { x, y: H - h, width: larg, height: h, rx: 2, class: "ges-chart__barra" });
      r.append(svg("title"));
      r.firstChild.textContent = `${it.rotulo}: ${it.valor}`;
      root.append(r);
    }
    if (i % passo === 0) {
      const t = svg("text", { x: x + larg / 2, y: H + 13, class: "ges-chart__rotulo", "text-anchor": "middle" });
      t.textContent = it.rotulo;
      root.append(t);
    }
  });
  return root;
}

function graficoBarras(itens) {
  const lista = el("ul", "ges-barras");
  const max = Math.max(...itens.map((i) => i.valor), 1);
  for (const it of itens) {
    const li = el("li", "ges-barras__item");
    const barra = el("span", "ges-barras__trilho");
    const preenchido = el("span", "ges-barras__valor");
    preenchido.style.width = `${Math.max(3, (it.valor / max) * 100)}%`;
    barra.append(preenchido);
    li.append(el("span", "ges-barras__rotulo", it.rotulo), barra, el("span", "ges-barras__num", String(it.valor)));
    lista.append(li);
  }
  return lista;
}

// ---- Render ----------------------------------------------------------------------

function kpi(valor, rotulo, detalhe) {
  const card = el("div", "ges-kpi");
  card.append(el("p", "ges-kpi__valor", valor), el("p", "ges-kpi__rotulo", rotulo));
  if (detalhe) card.append(el("p", "ges-kpi__detalhe", detalhe));
  return card;
}

function render() {
  const f = filtros();
  $("ges-datas").hidden = f.periodo !== "personalizado";
  const lista = filtrar(eventos, f);
  const k = indicadores(lista);
  const faixa = intervalo(f, eventos);

  $("ges-vazio").hidden = eventos.length > 0;
  $("ges-conteudo").hidden = eventos.length === 0;
  if (!eventos.length) return;

  $("ges-kpis").replaceChildren(
    kpi(String(k.entrevistas), "Entrevistas transcritas", k.minutosEntrevista ? `${horas(k.minutosEntrevista)} de entrevista` : null),
    kpi(String(k.curriculos), "Currículos padronizados", k.curriculosBaixados ? `${k.curriculosBaixados} downloads` : null),
    kpi(String(k.comparativos), "Comparativos", k.candidatosComparados ? `${k.candidatosComparados} candidatos` : null),
    kpi(String(k.shortlists), "Shortlists", k.candidatosEncontrados ? `${k.candidatosEncontrados} candidatos encontrados` : null),
    kpi(String(k.salarios), "Pesquisas salariais"),
    kpi(String(k.traducoes), "Registros traduzidos"),
    kpi(String(k.chat), "Perguntas no Chat"),
    kpi(String(k.prompts), "Prompts usados"),
  );

  const s = serie(lista, faixa);
  $("ges-serie-titulo").textContent = `Atividades por ${s.modo === "dia" ? "dia" : s.modo === "semana" ? "semana" : "mês"}`;
  $("ges-serie").replaceChildren(
    lista.length ? graficoColunas(s.itens, "Atividades ao longo do período") : el("p", "hint", "Sem atividades no período."),
  );
  const tipos = porTipo(lista);
  $("ges-tipos").replaceChildren(tipos.length ? graficoBarras(tipos) : el("p", "hint", "Sem atividades no período."));

  // Histórico, do mais recente para o mais antigo, com busca.
  const termo = $("ges-busca").value.trim().toLowerCase();
  const linhas = [...lista]
    .sort((a, b) => b.em - a.em)
    .filter((e) => !termo || `${TIPOS[e.tipo]?.singular} ${descrever(e)}`.toLowerCase().includes(termo));
  $("ges-historico-titulo").textContent = `Histórico (${linhas.length})`;
  $("ges-historico").replaceChildren(
    ...linhas.slice(0, mostrar).map((e) => {
      const li = el("li", "ges-evento");
      li.append(
        el("span", "ges-evento__data", dataHora(e.em)),
        el("span", "ges-evento__tipo", TIPOS[e.tipo]?.singular ?? e.tipo),
        el("span", "ges-evento__detalhe", descrever(e) || "—"),
      );
      return li;
    }),
  );
  if (!linhas.length) $("ges-historico").append(el("li", "hint", "Nenhuma atividade encontrada."));
  $("ges-mais").hidden = linhas.length <= mostrar;
}

async function recarregar() {
  eventos = await listarAtividades();
  render();
}

// ---- PDF -------------------------------------------------------------------------

async function baixarPdf() {
  const botao = $("ges-pdf");
  botao.disabled = true;
  botao.textContent = "Gerando PDF…";
  showError("ges-erro", null);
  try {
    const branding = (await chrome.storage.local.get("branding")).branding ?? {};
    const rel = relatorio(eventos, filtros(), { empresa: branding.empresa });
    const { gestaoPdf } = await import("./pdf.js");
    const blob = await gestaoPdf(rel, branding);
    saveBlob(blob, `${branding.empresa ? `${branding.empresa} - ` : ""}Gestão do recrutador ${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error(error);
    showError("ges-erro", "Não foi possível gerar o PDF.");
  } finally {
    botao.disabled = false;
    botao.textContent = "Baixar PDF";
  }
}

// ---- Motion ----------------------------------------------------------------------

function preencherSelect(id, opcoes, valor) {
  $(id).replaceChildren(...Object.entries(opcoes).map(([v, rotulo]) => Object.assign(document.createElement("option"), { value: v, textContent: rotulo })));
  $(id).value = valor;
}

async function criarMotion(event) {
  event.preventDefault();
  const botao = $("ges-motion-enviar");
  botao.disabled = true;
  botao.textContent = "Criando o roteiro…";
  $("ges-motion-status").textContent = "A IA está escrevendo o roteiro com os números do período (10 a 40 s).";
  try {
    const nomeEmpresa = await empresa();
    const rel = relatorio(eventos, filtros(), { empresa: nomeEmpresa });
    const opcoes = {
      publico: $("ges-motion-publico").value,
      tom: $("ges-motion-tom").value,
      duracao: Number($("ges-motion-duracao").value),
      formato: $("ges-motion-formato").value,
    };
    const briefing = $("ges-motion-briefing").value.trim();
    const { gerarRoteiro } = await import("../../../extensao-bp/src/motion/roteiro.js");
    const { roteiro, origem, aviso } = await gerarRoteiro({ rel, briefing, opcoes, keys: getKeys() });
    await chrome.storage.session.set({
      motionGestao: { roteiro, origem, aviso: aviso ?? null, briefing, empresa: nomeEmpresa, kicker: `${nomeEmpresa ? `${nomeEmpresa} · ` : ""}Gestão do recrutador`.slice(0, 60) },
    });
    chrome.tabs.create({ url: chrome.runtime.getURL("motion.html") });
    $("ges-motion").close();
  } catch (error) {
    console.error(error);
    $("ges-motion-status").textContent = error instanceof FriendlyError ? error.message : "Não foi possível criar o Motion agora.";
  } finally {
    botao.disabled = false;
    botao.textContent = "Criar apresentação";
  }
}

// ---- Início ----------------------------------------------------------------------

export async function initGestaoArea({ keysGetter }) {
  getKeys = keysGetter;
  preencherSelect("ges-periodo", PERIODOS, "30");
  preencherSelect("ges-tipo", { todos: "Todas as funcionalidades", ...Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [k, v.rotulo])) }, "todos");
  preencherSelect("ges-motion-publico", OPCOES.publico, "diretoria");
  preencherSelect("ges-motion-tom", OPCOES.tom, "executivo");
  preencherSelect("ges-motion-duracao", OPCOES.duracao, "45");
  preencherSelect("ges-motion-formato", OPCOES.formato, "16:9");

  for (const id of ["ges-periodo", "ges-tipo", "ges-de", "ges-ate"]) {
    $(id).addEventListener("change", () => {
      mostrar = PAGINA;
      render();
    });
  }
  $("ges-busca").addEventListener("input", render);
  $("ges-mais").addEventListener("click", () => {
    mostrar += PAGINA;
    render();
  });
  $("ges-pdf").addEventListener("click", baixarPdf);
  $("ges-motion-abrir").addEventListener("click", () => {
    $("ges-motion-status").textContent = "";
    $("ges-motion").showModal();
  });
  $("ges-motion-fechar").addEventListener("click", () => $("ges-motion").close());
  $("ges-motion-form").addEventListener("submit", criarMotion);

  // Atualiza ao vivo quando outra funcionalidade registra uma atividade.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && "atividades" in changes) {
      eventos = changes.atividades.newValue ?? [];
      render();
    }
  });
  await recarregar();
}
