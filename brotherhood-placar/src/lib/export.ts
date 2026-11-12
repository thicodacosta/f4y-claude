import type { MatchState } from '../domain/types';

/** Bibliotecas de exportação são carregadas sob demanda: não pesam no placar. */
export async function renderPng(node: HTMLElement): Promise<string> {
  const { toPng } = await import('html-to-image');
  return toPng(node, { pixelRatio: 1, cacheBust: true, backgroundColor: '#070b18' });
}

export function download(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function savePdf(png: string, filename: string, width: number, height: number) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const maxW = 180;
  const maxH = 257;
  const scale = Math.min(maxW / width, maxH / height);
  const w = width * scale;
  const h = height * scale;
  pdf.addImage(png, 'PNG', (210 - w) / 2, 20, w, h);
  pdf.save(filename);
}

export async function sharePng(png: string, filename: string, title: string): Promise<boolean> {
  try {
    const blob = await (await fetch(png)).blob();
    const file = new File([blob], filename, { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] })) return false;
    await navigator.share({ files: [file], title });
    return true;
  } catch {
    return false;
  }
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const exportName = (m: MatchState, ext: 'png' | 'pdf') =>
  `brotherhood-${slug(m.teams.A.name)}-x-${slug(m.teams.B.name)}-${m.info.date}.${ext}`;
