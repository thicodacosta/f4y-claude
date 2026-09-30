// Teste da camada de IA (lib/ia.ts) contra um servidor falso local — sem chave real.
// Uso: npx tsx --conditions=react-server scripts/e2e/ia.mts
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { completarJson, ErroIa, insightsSchema } from "../../lib/ia";
import { analisarPergunta, resumoParaIa } from "../../lib/pulse/analise";
import type { LinhaDistribuicao, PerguntaDef } from "../../lib/pulse/perguntas";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}

const INSIGHTS = {
  resumo_executivo: "Clima positivo.",
  pontos_fortes: ["Clareza"],
  pontos_atencao: ["Carga"],
  riscos: ["Sobrecarga"],
  plano_acao: [{ acao: "Revisar prioridades", prioridade: "Alta", prazo_sugerido: "30 dias", responsavel_sugerido: "Lideranças" }],
};

// Próxima resposta do servidor falso e último pedido recebido.
let proxima: { status: number; texto: string } = { status: 200, texto: "" };
type Pedido = { headers: IncomingMessage["headers"]; corpo: { model: string; system: string; messages: { content: string }[] } };
let ultimo: Pedido | null = null;
const ultimoPedido = () => ultimo;
const servidor = createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    ultimo = { headers: req.headers, corpo: JSON.parse(b) };
    res.writeHead(proxima.status, { "content-type": "application/json" });
    res.end(JSON.stringify({ content: [{ type: "text", text: proxima.texto }] }));
  });
});
await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
process.env.IA_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/v1/messages`;
process.env.IA_MODELO = "modelo-teste";

const pedir = () => completarJson({ sistema: "SISTEMA", usuario: '{"x":1}', schema: insightsSchema });
const erroDe = async () => {
  try {
    await pedir();
    return null;
  } catch (e) {
    return e;
  }
};

try {
  delete process.env.ANTHROPIC_API_KEY;
  const semChave = await erroDe();
  checar("Sem chave: erro amigável e nenhuma chamada", semChave instanceof ErroIa && ultimoPedido() === null);

  process.env.ANTHROPIC_API_KEY = "chave-falsa";
  proxima = { status: 200, texto: JSON.stringify(INSIGHTS) };
  const r = await pedir();
  checar("JSON válido é aceito e validado", r.plano_acao[0].acao === "Revisar prioridades");
  const pedido = ultimoPedido()!;
  checar(
    "Pedido com chave, versão da API, modelo e prompt de sistema",
    pedido.headers["x-api-key"] === "chave-falsa" && pedido.headers["anthropic-version"] === "2023-06-01" && pedido.corpo.model === "modelo-teste" && pedido.corpo.system === "SISTEMA",
  );

  proxima = { status: 200, texto: `Segue a análise:\n${JSON.stringify(INSIGHTS)}\nEspero ter ajudado.` };
  checar("JSON cercado de texto é extraído", (await pedir()).resumo_executivo === "Clima positivo.");

  proxima = { status: 200, texto: '{"resumo_executivo": "só isso"}' };
  checar("Formato fora do esquema vira erro amigável", (await erroDe()) instanceof ErroIa);

  proxima = { status: 500, texto: "" };
  const e500 = await erroDe();
  checar("Falha HTTP vira erro amigável", e500 instanceof ErroIa && /HTTP 500/.test((e500 as Error).message));

  // O que vai para a IA: só agregados — sem comentários livres.
  const perguntas: PerguntaDef[] = [
    { id: "a", type: "likert", text: "Carga sustentável", required: true, order: 0 },
    { id: "b", type: "long_text", text: "Comentários", required: false, order: 1 },
  ];
  const dist: LinhaDistribuicao[] = [
    { pergunta_id: "A", linha: null, opcao: null, valor: 4, n: 6, respondentes: 10 },
    { pergunta_id: "A", linha: null, opcao: null, valor: 2, n: 4, respondentes: 10 },
  ];
  const comentarios = [{ pergunta_id: "B", linha: null, texto: "texto sensível de uma pessoa" }];
  const resumo = resumoParaIa([analisarPergunta(perguntas[0], "A", dist, comentarios), analisarPergunta(perguntas[1], "B", dist, comentarios)]);
  const serial = JSON.stringify(resumo);
  checar("Resumo para IA tem médias e distribuição", resumo.length === 1 && resumo[0].media === 3.2 && /percentual/.test(serial), serial);
  checar("Resumo para IA exclui comentários livres", !/texto sensível/.test(serial) && !/Comentários/.test(serial));
} finally {
  servidor.close();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
