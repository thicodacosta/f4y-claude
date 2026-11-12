/**
 * Captura de áudio em PCM cru, fechada em blocos WAV. Mesma abordagem do
 * Candydate (matchwork/chrome-extension/offscreen), que chegou a ela depois
 * de o MediaRecorder gerar blocos WebM vazios em produção. WAV é só um
 * cabeçalho fixo mais as amostras: não há ambiguidade de container.
 */

// A Whisper trabalha internamente a 16 kHz; reamostrar antes de enviar
// reduz o upload a um terço sem perder qualidade de transcrição.
const TARGET_SAMPLE_RATE = 16000;
// Blocos com menos de 1s não têm fala transcrevível.
const MIN_CHUNK_SECONDS = 1;

// O Meet/Teams já processa o mesmo microfone com cancelamento de eco e
// redução de ruído; duas cadeias disputando a entrada reduziam o sinal a
// quase zero no Candydate. Desligar o processamento só na nossa captura
// evita a disputa.
const RAW_AUDIO_CONSTRAINTS = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

const isMobileDevice = (label) => /iphone|ipad/i.test(label || "");

/**
 * Microfone local, evitando iPhone/iPad (Continuity do macOS), que aparece
 * como entrada válida mas só capta quem fala perto do aparelho.
 */
export async function getMicStream() {
  const initial = await navigator.mediaDevices.getUserMedia({ audio: RAW_AUDIO_CONSTRAINTS });
  const track = initial.getAudioTracks()[0];
  if (!track || !isMobileDevice(track.label)) return initial;

  const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
  const alternative = inputs.find((d) => d.deviceId && !isMobileDevice(d.label));
  if (!alternative) return initial;

  initial.getTracks().forEach((t) => t.stop());
  return navigator.mediaDevices.getUserMedia({
    audio: { ...RAW_AUDIO_CONSTRAINTS, deviceId: { exact: alternative.deviceId } },
  });
}

export function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Reamostragem por média de janelas: simples e suficiente para voz. */
export function downsample(samples, fromRate, toRate) {
  if (fromRate <= toRate) return samples;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    out[i] = sum / (end - start);
  }
  return out;
}

/**
 * Acumula amostras do stream e, a cada `chunkMs`, entrega um bloco WAV via
 * `onChunk({ wav, startMs, rms })`. `startMs` vem de `clock()`: o tempo de
 * gravação ativa no momento da primeira amostra do bloco, para ordenar as
 * falas das duas trilhas depois.
 */
export function createSegmentRecorder(stream, { chunkMs, clock, onChunk }) {
  const audioCtx = new AudioContext();
  audioCtx.resume().catch(() => {});
  const source = audioCtx.createMediaStreamSource(stream);
  // ScriptProcessorNode é antigo, mas é o que se provou confiável no Candydate.
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  // O grafo só "puxa" áudio se chegar ao destino; ganho zero evita tocar
  // o microfone ou duplicar o som da reunião.
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;

  let buffers = [];
  let sampleCount = 0;
  let chunkStartMs = null;
  let paused = false;
  let stopped = false;

  processor.onaudioprocess = (event) => {
    if (paused || stopped) return;
    if (chunkStartMs === null) chunkStartMs = clock();
    const data = event.inputBuffer.getChannelData(0);
    buffers.push(new Float32Array(data)); // cópia: o navegador recicla o buffer original
    sampleCount += data.length;
  };

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  function flush() {
    const parts = buffers;
    const total = sampleCount;
    const startMs = chunkStartMs;
    buffers = [];
    sampleCount = 0;
    chunkStartMs = null;
    if (total < audioCtx.sampleRate * MIN_CHUNK_SECONDS) return;

    const merged = new Float32Array(total);
    let offset = 0;
    for (const part of parts) {
      merged.set(part, offset);
      offset += part.length;
    }
    let sumSquares = 0;
    for (const s of merged) sumSquares += s * s;
    const rms = Math.sqrt(sumSquares / merged.length);

    const wav = encodeWav(downsample(merged, audioCtx.sampleRate, TARGET_SAMPLE_RATE), TARGET_SAMPLE_RATE);
    onChunk({ wav, startMs, rms });
  }

  const intervalId = setInterval(() => {
    if (!paused && !stopped) flush();
  }, chunkMs);

  return {
    pause() {
      paused = true;
      flush(); // fecha o que já foi captado em vez de perder
    },
    resume() {
      paused = false;
    },
    /** Com `discard`, descarta o bloco em andamento (gravação cancelada). */
    async stop({ discard = false } = {}) {
      if (stopped) return;
      stopped = true;
      clearInterval(intervalId);
      if (!discard) flush();
      try {
        source.disconnect();
        processor.disconnect();
        silentGain.disconnect();
      } catch {
        // já desconectado
      }
      await audioCtx.close().catch(() => {});
    },
  };
}
