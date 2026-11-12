/**
 * Sons sintetizados com WebAudio: nenhum arquivo para baixar, funciona offline.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, duration: number, gain = 0.18, type: OscillatorType = 'triangle') {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export const sounds = {
  /** Destrava o áudio no primeiro toque do usuário (exigência dos navegadores). */
  unlock: () => void audio(),
  point: () => tone(880, 0, 0.16, 0.14),
  timeout: () => {
    tone(523, 0, 0.25, 0.16, 'square');
    tone(523, 0.32, 0.25, 0.16, 'square');
  },
  setEnd: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.13, 0.45)),
  matchEnd: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.5, 0.2));
    [784, 1047].forEach((f) => tone(f, 0.7, 1.1, 0.16));
  },
};
