/**
 * Ações presentes em toda funcionalidade: "Baixar PDF" e "Gerar Motion".
 * `montar()` devolve o relatório (ver relatorio.js) com os dados exibidos.
 */
import { salvarDocumento, store } from "./db.js";
import { FriendlyError, loadKeys } from "./toolskit.js";
import { campo, h, icone, modal, ocupado, select, toast } from "./ui.js";
import { OPCOES } from "../motion/opcoes.js";

const DICAS = {
  onboarding: "Ex.: Apresente à diretoria a evolução dos onboardings do trimestre, destacando atrasos e a próxima turma.",
  produtividade: "Ex.: Mostre para as lideranças os critérios mais fortes e os que precisam de plano de ação.",
  cultura: "Ex.: Vídeo inspirador para o time sobre nossos pilares de cultura mais bem avaliados.",
  turnover: "Ex.: Resumo executivo do turnover dos últimos 12 meses, custo e principais motivos.",
  pulso: "Ex.: Devolutiva do Pulso para todo o time: o que ouvimos e o que vamos fazer.",
  offboarding: "Ex.: Principais aprendizados das entrevistas de desligamento para o comitê de pessoas.",
  gestao: "Ex.: Panorama atual, histórico e projeção de 6 meses para o conselho.",
  pessoas: "Ex.: Retrospectiva da jornada desta pessoa para a conversa de carreira.",
};

export async function baixarPdf(montar, botao) {
  await ocupado(botao, "Gerando PDF…", async () => {
    try {
      const { gerarPdf } = await import("./relatorio.js");
      await gerarPdf(montar());
      toast("PDF baixado.");
    } catch (e) {
      console.error(e);
      toast(e instanceof FriendlyError ? e.message : "Não foi possível gerar o PDF.");
    }
  });
}

/** Diálogo do Motion: pedido, público, tom, duração e formato → roteiro → player. */
export async function gerarMotion(montar) {
  const rel = montar();
  await modal(
    "Gerar Motion",
    (fechar) => {
      const briefing = h("textarea", { rows: 4, placeholder: DICAS[rel.modulo] ?? "Descreva o que você quer apresentar, para quem e com qual mensagem." });
      const opcoes = (chave, valor) => select(Object.entries(OPCOES[chave]), valor);
      const publico = opcoes("publico", "diretoria");
      const tom = opcoes("tom", "executivo");
      const duracao = opcoes("duracao", "45");
      const formato = opcoes("formato", "16:9");
      const status = h("p", { class: "hint", role: "status" });
      const enviar = h("button", { type: "submit", class: "btn btn--primary" }, "Gerar apresentação");
      let abort = null;

      const form = h(
        "form",
        {
          novalidate: true,
          onsubmit: async (e) => {
            e.preventDefault();
            await ocupado(enviar, "Criando o roteiro…", async () => {
              status.textContent = "A IA está escrevendo o roteiro com base nos dados desta tela (10 a 40 s).";
              try {
                const { gerarRoteiro } = await import("../motion/roteiro.js");
                abort = new AbortController();
                const opcoes = { publico: publico.value, tom: tom.value, duracao: Number(duracao.value), formato: formato.value };
                const { roteiro, origem, aviso } = await gerarRoteiro({ rel, briefing: briefing.value.trim(), opcoes, keys: await loadKeys(), signal: abort.signal });
                const conteudo = { roteiro, origem, briefing: briefing.value.trim(), empresa: store.empresaNome, kicker: `${store.empresaNome} · ${rel.titulo}`.slice(0, 60) };
                const doc = await salvarDocumento({ tipo: "motion", modulo: rel.modulo, titulo: roteiro.titulo, conteudo, colaboradorId: rel.colaboradorId ?? null });
                await chrome.storage.session.set({ [`motion:${doc.id}`]: doc });
                chrome.tabs.create({ url: chrome.runtime.getURL(`motion.html?id=${doc.id}`) });
                if (aviso) toast(`Motion criado com o roteiro-base. ${aviso}`);
                fechar(true);
              } catch (err) {
                console.error(err);
                status.textContent = err instanceof FriendlyError ? err.message : "Não foi possível gerar o Motion agora.";
              }
            });
          },
        },
        campo("O que você quer apresentar?", briefing, "Diga o foco, a mensagem principal e para quem é. Os números vêm sempre dos dados desta tela."),
        h("div", { class: "field-grid" }, campo("Público", publico), campo("Tom", tom), campo("Duração", duracao), campo("Formato", formato)),
        status,
        enviar,
      );
      return form;
    },
    { largo: true },
  );
}

/** Barra com os dois botões, para o topo de cada funcionalidade. */
export function barraAcoes(montar) {
  const pdf = h("button", { type: "button", class: "btn btn--ghost btn--sm" }, icone("pdf"), "Baixar PDF");
  pdf.addEventListener("click", () => baixarPdf(montar, pdf));
  const motion = h("button", { type: "button", class: "btn btn--ghost btn--sm" }, icone("motion"), "Gerar Motion");
  motion.addEventListener("click", () => gerarMotion(montar));
  return h("div", { class: "acoes-modulo" }, pdf, motion);
}

/** Cabeçalho padrão de uma funcionalidade. */
export function cabecalhoModulo({ eyebrow, titulo, lead, montar }) {
  return h(
    "header",
    { class: "modulo__topo" },
    h("p", { class: "eyebrow", text: eyebrow }),
    h("h1", { class: "title", text: titulo }),
    lead ? h("p", { class: "lead", text: lead }) : null,
    montar ? barraAcoes(montar) : null,
  );
}
