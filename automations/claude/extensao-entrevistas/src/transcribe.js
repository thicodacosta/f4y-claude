/**
 * Transcrição de um bloco de áudio via Whisper na Groq (API compatível com
 * a da OpenAI). Mesmo provedor e modelo do Candydate. A Anthropic não
 * oferece transcrição de áudio, por isso esta etapa usa outro serviço.
 */

const ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3-turbo";
const MAX_ATTEMPTS = 5;

// Em trechos sem fala a Whisper "alucina" frases curtas. Os dois limiares
// são os que a própria Whisper devolve para isso (valores do whisper.cpp),
// e a lista traz frases observadas em produção no Candydate.
const NO_SPEECH_PROB_THRESHOLD = 0.6;
const AVG_LOGPROB_THRESHOLD = -1.0;
const KNOWN_HALLUCINATIONS = new Set([
  "e ai",
  "e entao",
  "obrigado",
  "obrigada",
  "tchau tchau",
  "legendado pela comunidade amara org",
  "legendas pela comunidade amara org",
]);

export class TranscriptionAuthError extends Error {}

function normalize(text) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.!?,;:]+$/g, "");
}

function isRealSpeech(segment) {
  const text = segment.text?.trim();
  if (!text) return false;
  if ((segment.no_speech_prob ?? 0) > NO_SPEECH_PROB_THRESHOLD) return false;
  if ((segment.avg_logprob ?? 0) < AVG_LOGPROB_THRESHOLD) return false;
  return !KNOWN_HALLUCINATIONS.has(normalize(text));
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(signal.reason);
    });
  });

/**
 * Devolve `[{ start, text }]` (start em segundos, relativo ao bloco).
 * Refaz a chamada em limite de taxa, instabilidade ou falha de rede.
 */
export async function transcribeChunk(apiKey, wav, { signal } = {}) {
  for (let attempt = 1; ; attempt++) {
    const form = new FormData();
    form.append("file", wav, "trecho.wav");
    form.append("model", MODEL);
    form.append("response_format", "verbose_json");
    form.append("language", "pt");
    form.append("temperature", "0");

    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal,
      });
    } catch (error) {
      if (signal?.aborted || attempt >= MAX_ATTEMPTS) throw error;
      await sleep(2000 * attempt, signal);
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const segments = data.segments ?? (data.text ? [{ start: 0, text: data.text }] : []);
      return segments.filter(isRealSpeech).map((s) => ({ start: s.start ?? 0, text: s.text.trim() }));
    }

    if (res.status === 401 || res.status === 403) {
      throw new TranscriptionAuthError("A chave da Groq é inválida ou não tem permissão. Revise em Configurações.");
    }
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt;
      await sleep(Math.min(waitMs, 60_000), signal);
      continue;
    }
    throw new Error(`Groq respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}
