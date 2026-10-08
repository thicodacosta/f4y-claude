// Mini-driver do Chrome para os testes: perfil temporário, extensão carregada
// pelo DevTools Protocol (Extensions.loadUnpacked, via pipe — o Chrome atual
// não aceita mais --load-extension) e sessões por aba (flatten).
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export async function abrirChrome({ extensao, headless = true, downloads }) {
  const perfil = mkdtempSync(join(tmpdir(), "bp-e2e-"));
  const args = [
    ...(headless ? ["--headless=new"] : []),
    "--remote-debugging-pipe",
    "--enable-unsafe-extension-debugging",
    `--user-data-dir=${perfil}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1400,1000",
    "about:blank",
  ];
  const proc = spawn(CHROME, args, { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
  const escrita = proc.stdio[3];
  const leitura = proc.stdio[4];
  let seq = 0;
  const pend = new Map();
  const ouvintes = new Set();
  let buffer = "";
  leitura.on("data", (chunk) => {
    buffer += chunk.toString();
    let i;
    while ((i = buffer.indexOf("\0")) >= 0) {
      const msg = JSON.parse(buffer.slice(0, i));
      buffer = buffer.slice(i + 1);
      if (msg.id && pend.has(msg.id)) {
        pend.get(msg.id)(msg);
        pend.delete(msg.id);
      } else ouvintes.forEach((f) => f(msg));
    }
  });
  const cdp = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const id = ++seq;
      pend.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
      escrita.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + "\0");
    });

  const { id: extensaoId } = await cdp("Extensions.loadUnpacked", { path: resolve(extensao) });
  if (downloads) await cdp("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads, eventsEnabled: true });

  const logs = [];
  ouvintes.add((m) => {
    if (m.method === "Runtime.exceptionThrown") logs.push(`EXCEÇÃO: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
    if (m.method === "Runtime.consoleAPICalled" && ["error"].includes(m.params.type)) logs.push(`console.error: ${m.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`);
  });

  async function aba(url) {
    const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
    const s = (m, p) => cdp(m, p, sessionId);
    await s("Page.enable");
    await s("Runtime.enable");
    await s("Emulation.setDeviceMetricsOverride", { width: 420, height: 900, deviceScaleFactor: 2, mobile: false });
    const avaliar = async (expr) => {
      const r = await s("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result?.value;
    };
    const p = {
      targetId,
      avaliar,
      async ir(u) {
        await s("Page.navigate", { url: u });
        await esperar(600);
      },
      async esperarAte(expr, ms = 20000) {
        const fim = Date.now() + ms;
        while (Date.now() < fim) {
          try {
            if (await avaliar(`(()=>{try{return !!(${expr})}catch{return false}})()`)) return true;
          } catch {}
          await esperar(250);
        }
        return false;
      },
      async tamanho(width, height, scale = 2) {
        await s("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
      },
      async foto(arquivo, { inteira = false } = {}) {
        const { writeFileSync } = await import("node:fs");
        const r = await s("Page.captureScreenshot", { format: "png", captureBeyondViewport: inteira });
        writeFileSync(arquivo, Buffer.from(r.data, "base64"));
      },
      /** Seleciona um arquivo local num <input type=file>. */
      async enviarArquivo(seletor, caminho) {
        const { root } = await s("DOM.getDocument", { depth: -1, pierce: true });
        const { nodeId } = await s("DOM.querySelector", { nodeId: root.nodeId, selector: seletor });
        await s("DOM.setFileInputFiles", { nodeId, files: [caminho] });
      },
      fechar: () => cdp("Target.closeTarget", { targetId }),
    };
    if (url) await p.ir(url);
    return p;
  }

  return {
    extensaoId,
    url: (caminho) => `chrome-extension://${extensaoId}/${caminho}`,
    aba,
    logs,
    async fechar() {
      try {
        await cdp("Browser.close");
      } catch {}
      proc.kill();
    },
  };
}
