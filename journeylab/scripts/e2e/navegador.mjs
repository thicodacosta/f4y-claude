// Mini-driver de Chrome headless via DevTools Protocol (sem dependências).
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const BASE = process.env.E2E_BASE ?? "http://localhost:3020";
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export async function abrirNavegador(porta = 9444) {
  const perfil = mkdtempSync(join(tmpdir(), "jl-e2e-"));
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  let alvo;
  for (let i = 0; i < 120 && !alvo; i++) {
    await esperar(250);
    try { alvo = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find((t) => t.type === "page"); } catch {}
  }
  if (!alvo) throw new Error("Chrome headless não respondeu.");
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0;
  const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const cdp = (method, params = {}) => new Promise((r) => { const id = ++seq; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Network.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  const avaliar = async (expr) => (await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

  const nav = {
    /** Espera até a expressão ser verdadeira (máx. `ms`). */
    async esperarAte(expr, ms = 20000) {
      const fim = Date.now() + ms;
      while (Date.now() < fim) {
        if (await avaliar(`(()=>{try{return !!(${expr})}catch{return false}})()`)) return true;
        await esperar(300);
      }
      return false;
    },
    /** Espera o endereço parar de mudar (redirecionamentos encadeados, compilação do modo dev). */
    async esperarEstavel(ms = 20000) {
      const fim = Date.now() + ms;
      let anterior = "";
      let iguais = 0;
      while (Date.now() < fim) {
        const u = await avaliar("document.readyState === 'complete' && document.querySelector('main') ? location.pathname + location.search : ''");
        if (u && u === anterior) { if (++iguais >= 3) return; } else { iguais = 0; anterior = u; }
        await esperar(400);
      }
    },
    async ir(caminho) {
      await cdp("Page.navigate", { url: BASE + caminho });
      await esperar(300);
      await nav.esperarEstavel();
      return nav.estado();
    },
    async estado() {
      return avaliar(`({ url: location.pathname + location.search, h1: document.querySelector('main h1, h1')?.textContent?.trim() ?? '', texto: document.querySelector('main')?.innerText ?? document.body.innerText })`);
    },
    avaliar,
    async preencher(campos) {
      await avaliar(`(()=>{const campos=${JSON.stringify(campos)};for(const [sel,v] of Object.entries(campos)){const el=document.querySelector(sel);if(!el) throw new Error('campo '+sel);
        if(el.type==='checkbox'){el.checked=!!v;continue;}
        const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));}})()`);
    },
    /** Envia o formulário que contém o seletor e devolve a mensagem exibida (role=status/alert). */
    async enviar(seletorNoForm, ms = 3000) {
      await avaliar(`document.querySelector(${JSON.stringify(seletorNoForm)}).form.requestSubmit()`);
      await esperar(ms);
      return nav.estado();
    },
    async mensagem() {
      return avaliar(`[...document.querySelectorAll('[role=status],[role=alert]')].map(e=>e.textContent.trim()).filter(Boolean).join(' | ')`);
    },
    async entrar(email, senha = "JourneyLab2026") {
      await cdp("Network.clearBrowserCookies");
      await nav.ir("/entrar");
      await nav.esperarAte("document.querySelector('#email')");
      await nav.preencher({ "#email": email, "#senha": senha });
      await avaliar(`document.querySelector("#email").form.requestSubmit()`);
      // Aguarda sair do login e o destino final estabilizar (ex.: /inicio → /plataforma).
      await nav.esperarAte("!location.pathname.startsWith('/entrar') || document.querySelector('[role=alert]')", 25000);
      await nav.esperarEstavel();
      return nav.estado();
    },
    /** Seleciona um arquivo local num <input type=file>. */
    async anexar(seletor, caminho) {
      const { result: doc } = await cdp("DOM.getDocument", { depth: 0 });
      const { result: no } = await cdp("DOM.querySelector", { nodeId: doc.root.nodeId, selector: seletor });
      if (!no?.nodeId) throw new Error(`input ${seletor} não encontrado`);
      await cdp("DOM.setFileInputFiles", { nodeId: no.nodeId, files: [caminho] });
    },
    async cookie(nome, valor) {
      await cdp("Network.setCookie", { name: nome, value: valor, url: BASE, path: "/", httpOnly: true });
    },
    fechar() { ws.close(); proc.kill(); },
  };
  return nav;
}
