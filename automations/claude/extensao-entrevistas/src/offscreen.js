/**
 * Motor da gravação. O offscreen document é o único contexto de uma
 * extensão MV3 com getUserMedia/AudioContext, e continua vivo quando o
 * painel é fechado. Captura duas trilhas separadas, sem adivinhar quem fala:
 *
 *  - candidato: o áudio que toca na aba da reunião (o outro lado da chamada);
 *  - recrutador: o microfone deste computador.
 *
 * Cada bloco de áudio fica em memória só até ser transcrito e nunca é salvo.
 * Ao finalizar, a transcrição completa vai ao Claude e o registro volta ao
 * background, que o guarda para o painel.
 */
import { analyzeInterview, AnalysisError } from "./analyze.js";
import { createSegmentRecorder, getMicStream } from "./audio.js";
import { transcribeChunk, TranscriptionAuthError } from "./transcribe.js";
import { buildTranscript } from "./transcript.js";

// Blocos maiores dão mais contexto à Whisper e consomem menos requisições
// da cota da Groq; o custo é só o atraso do último bloco ao finalizar.
const CHUNK_MS = 20_000;
// Abaixo disso o bloco é silêncio digital ou ruído de fundo: não vale uma
// chamada (e evita alucinação da Whisper). Baixo de propósito, porque o
// microfone sem processamento capta fala real com RMS perto de 0,01.
const SILENCE_RMS = 0.0015;

let rec = null;

function toBackground(message) {
  return chrome.runtime.sendMessage({ target: "background", ...message }).catch(() => {});
}

function createClock() {
  const startedAt = performance.now();
  let pausedTotal = 0;
  let pausedAt = null;
  return {
    now: () => (pausedAt ?? performance.now()) - startedAt - pausedTotal,
    pause: () => {
      pausedAt ??= performance.now();
    },
    resume: () => {
      if (pausedAt !== null) pausedTotal += performance.now() - pausedAt;
      pausedAt = null;
    },
  };
}

function handleChunk(role, { wav, startMs, rms }) {
  if (!rec || rms < SILENCE_RMS) return;
  const { keys, abort } = rec;
  const current = rec;

  const job = transcribeChunk(keys.groq, wav, { signal: abort.signal })
    .then((segments) => {
      for (const s of segments) current.segments.push({ role, t: startMs + s.start * 1000, text: s.text });
      toBackground({ type: "CHUNK", role, ok: true, speech: segments.length > 0 });
    })
    .catch((error) => {
      if (abort.signal.aborted) return;
      console.error(`Falha ao transcrever trecho (${role})`, error);
      current.segments.push({ role, t: startMs, text: null });
      toBackground({ type: "CHUNK", role, ok: false });
      if (error instanceof TranscriptionAuthError && !current.authWarned) {
        current.authWarned = true;
        toBackground({ type: "WARNING", message: error.message });
      }
    });

  current.pending.add(job);
  job.finally(() => current.pending.delete(job));
}

async function start({ streamId, keys, meta }) {
  const warnings = [];
  const clock = createClock();
  const abort = new AbortController();

  const tabStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
  });
  // Capturar a aba silencia o som dela para o usuário; tocar o mesmo
  // stream de volta mantém a reunião audível.
  const playback = new Audio();
  playback.srcObject = tabStream;
  playback.play().catch(() => {});

  let micStream = null;
  try {
    micStream = await getMicStream();
  } catch (error) {
    console.error("Microfone indisponível", error);
    warnings.push("Microfone indisponível: apenas o áudio da reunião será transcrito.");
  }

  rec = {
    keys,
    meta,
    clock,
    abort,
    tabStream,
    micStream,
    playback,
    segments: [],
    pending: new Set(),
    recorders: [],
    finishing: false,
    authWarned: false,
  };

  const recorderFor = (role, stream) =>
    createSegmentRecorder(stream, { chunkMs: CHUNK_MS, clock: clock.now, onChunk: (c) => handleChunk(role, c) });
  rec.recorders.push(recorderFor("candidato", tabStream));
  if (micStream) rec.recorders.push(recorderFor("recrutador", micStream));

  // A aba da reunião foi fechada ou saiu da chamada: encerra e gera o
  // registro com o que já foi captado.
  tabStream.getAudioTracks()[0]?.addEventListener("ended", () => {
    if (rec && !rec.finishing) finish();
  });

  return { ok: true, warnings, hasMic: Boolean(micStream) };
}

function releaseStreams(current) {
  current.tabStream.getTracks().forEach((t) => t.stop());
  current.micStream?.getTracks().forEach((t) => t.stop());
  current.playback.pause();
  current.playback.srcObject = null;
}

async function finish() {
  const current = rec;
  if (!current || current.finishing) return;
  current.finishing = true;
  toBackground({ type: "PHASE", phase: "finishing" });

  // Fecha o último bloco de cada trilha e espera todas as transcrições.
  await Promise.all(current.recorders.map((r) => r.stop()));
  releaseStreams(current);
  while (current.pending.size > 0) await Promise.allSettled([...current.pending]);

  if (rec !== current) return; // cancelado enquanto finalizava

  const transcricao = buildTranscript(current.segments, {
    unavailableRoles: current.micStream ? [] : ["recrutador"],
  });
  if (!current.segments.some((s) => s.text)) {
    toBackground({
      type: "FAILED",
      error:
        "Nenhuma fala foi transcrita. Verifique se a reunião estava tocando nesta aba, se o microfone está liberado e se a chave da Groq está correta.",
      transcricao: "",
    });
    rec = null;
    return;
  }

  toBackground({ type: "PHASE", phase: "analyzing" });
  try {
    const data = await analyzeInterview({
      apiKey: current.keys.anthropic,
      groqKey: current.keys.groq,
      input: { ...current.meta, transcricao, origem: "gravacao" },
      signal: current.abort.signal,
    });
    if (rec !== current) return;
    toBackground({ type: "DONE", data, transcricao });
  } catch (error) {
    if (rec !== current) return;
    console.error("Falha ao gerar o registro", error);
    toBackground({
      type: "FAILED",
      error: error instanceof AnalysisError ? error.message : "Erro inesperado ao gerar o registro.",
      transcricao,
    });
  }
  rec = null;
}

async function cancel() {
  const current = rec;
  if (!current) return;
  rec = null;
  current.abort.abort();
  await Promise.all(current.recorders.map((r) => r.stop({ discard: true })));
  releaseStreams(current);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "offscreen") return false;

  switch (message.type) {
    case "START":
      start(message)
        .then(sendResponse)
        .catch(async (error) => {
          console.error("Falha ao iniciar a captura", error);
          if (rec) await cancel();
          sendResponse({ ok: false, error: `Não foi possível capturar o áudio da aba (${error.message}).` });
        });
      return true;
    case "PAUSE":
      rec?.clock.pause();
      rec?.recorders.forEach((r) => r.pause());
      sendResponse({ ok: true });
      return false;
    case "RESUME":
      rec?.clock.resume();
      rec?.recorders.forEach((r) => r.resume());
      sendResponse({ ok: true });
      return false;
    case "STOP":
      finish();
      sendResponse({ ok: true });
      return false;
    case "CANCEL":
      cancel().then(() => sendResponse({ ok: true }));
      return true;
    default:
      return false;
  }
});
