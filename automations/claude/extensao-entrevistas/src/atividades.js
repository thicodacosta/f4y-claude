/**
 * Histórico de atividades do recrutador, base da aba Gestão: cada
 * funcionalidade registra o que foi feito (entrevista transcrita, currículo
 * padronizado, comparativo, Shortlist…). Fica em chrome.storage.local
 * (chave `atividades`), neste navegador; só metadados, nunca o conteúdo
 * (transcrições, currículos e perfis não entram aqui).
 *
 * Evento: { id, tipo, em (ms), dados: { … } }.
 */

const KEY = "atividades";
// Limite de eventos guardados (os mais antigos saem primeiro).
const MAX_EVENTS = 5000;

/** Tipos registrados, com rótulos para o painel, o PDF e o Motion. */
export const TIPOS = {
  entrevista: { rotulo: "Entrevistas transcritas", singular: "Entrevista transcrita" },
  traducao: { rotulo: "Registros traduzidos", singular: "Registro traduzido" },
  pdf_registro: { rotulo: "Registros em PDF", singular: "Registro baixado em PDF" },
  curriculo: { rotulo: "Currículos padronizados", singular: "Currículo padronizado" },
  curriculo_download: { rotulo: "Currículos baixados", singular: "Currículo baixado" },
  comparativo: { rotulo: "Comparativos", singular: "Comparativo de candidatos" },
  salario: { rotulo: "Pesquisas salariais", singular: "Pesquisa salarial" },
  shortlist: { rotulo: "Shortlists", singular: "Shortlist no LinkedIn" },
  chat: { rotulo: "Perguntas no Chat", singular: "Pergunta no Chat" },
  prompt: { rotulo: "Prompts usados", singular: "Prompt copiado" },
};

// Gravações do mesmo contexto em fila, para uma não sobrescrever a outra.
let queue = Promise.resolve();

/** Registra uma atividade. Nunca lança erro: o histórico não pode quebrar a funcionalidade. */
export function registrar(tipo, dados = {}) {
  queue = queue
    .then(async () => {
      const { [KEY]: atuais = [] } = await chrome.storage.local.get(KEY);
      atuais.push({ id: crypto.randomUUID(), tipo, em: Date.now(), dados });
      await chrome.storage.local.set({ [KEY]: atuais.slice(-MAX_EVENTS) });
    })
    .catch((error) => console.warn("Histórico: não foi possível registrar", tipo, error));
  return queue;
}

export async function listarAtividades() {
  return (await chrome.storage.local.get(KEY))[KEY] ?? [];
}
