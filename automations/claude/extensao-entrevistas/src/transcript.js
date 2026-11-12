export const ROLE_LABELS = { candidato: "Candidato", recrutador: "Recrutador" };

function timestamp(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${String(m).padStart(2, "0")}:${s}`;
}

/**
 * Junta as falas das duas trilhas em ordem cronológica, agrupando falas
 * seguidas da mesma pessoa. Cada item: `{ role, t, text }` (t em ms desde o
 * início da gravação); `text: null` marca um trecho que não foi transcrito.
 */
export function buildTranscript(segments, { unavailableRoles = [] } = {}) {
  const sorted = [...segments].sort((a, b) => a.t - b.t);
  const blocks = [];
  for (const seg of sorted) {
    const text = seg.text ?? "[trecho não transcrito]";
    const last = blocks.at(-1);
    if (last && last.role === seg.role && (seg.text !== null) === last.transcribed) {
      last.parts.push(text);
    } else {
      blocks.push({ role: seg.role, t: seg.t, parts: [text], transcribed: seg.text !== null });
    }
  }

  const lines = blocks.map((b) => `[${timestamp(b.t)}] ${ROLE_LABELS[b.role]}: ${b.parts.join(" ")}`);
  for (const role of unavailableRoles) {
    lines.push(`(Áudio do ${ROLE_LABELS[role].toLowerCase()} não disponível nesta gravação.)`);
  }
  return lines.join("\n\n");
}
