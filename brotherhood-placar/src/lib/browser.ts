import { useEffect, useState } from 'react';

/** Re-renderiza a cada `intervalMs` (para cronômetros). */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Mantém a tela acesa enquanto `active` (celular na mão do árbitro, TV no ginásio). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
      } catch {
        /* sem permissão / aba em segundo plano */
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && void request();
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}

export function useFullscreen() {
  const [isFull, setIsFull] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* iOS Safari não suporta fullscreen em elementos arbitrários */
    }
  };
  return { isFull, toggle, supported: !!document.documentElement.requestFullscreen };
}

/* Telão em janela separada (segunda tela / HDMI) */
let displayWindow: Window | null = null;

export function openDisplayWindow(url: string) {
  if (displayWindow && !displayWindow.closed) {
    displayWindow.focus();
    return;
  }
  displayWindow = window.open(url, 'brotherhood-telao', 'popup,width=1280,height=720');
}

export const displayWindowOpen = () => !!displayWindow && !displayWindow.closed;

/** Cor de texto legível sobre um fundo hex. */
export function readableOn(hex: string): '#0a0f1f' | '#ffffff' {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#0a0f1f' : '#ffffff';
}

/** Redimensiona uma imagem enviada para um data URL leve (cabe no localStorage). */
export function resizeImage(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const webp = canvas.toDataURL('image/webp', 0.85);
      resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagem inválida'));
    };
    img.src = url;
  });
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const formatTime = (epoch: number) =>
  new Date(epoch).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
