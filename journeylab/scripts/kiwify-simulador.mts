/**
 * SIMULADOR LOCAL da API pública da Kiwify — somente desenvolvimento.
 * Reproduz apenas o formato documentado (docs.kiwify.com.br): POST
 * /v1/oauth/token, GET /v1/sales (paginado: { pagination, data }) e GET
 * /v1/sales/{id}. Não simula o corpo do webhook (não documentado).
 *
 * Uso:
 *   npx tsx scripts/kiwify-simulador.mts servir                       (porta 3099)
 *   npx tsx scripts/kiwify-simulador.mts venda <email> <produto_id> <status> [nome]
 *   npx tsx scripts/kiwify-simulador.mts status <venda_id> <status>
 *   npx tsx scripts/kiwify-simulador.mts listar
 * Com o app: KIWIFY_API_URL=http://127.0.0.1:3099/v1 (+ credenciais quaisquer).
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ARQUIVO = new URL("./.kiwify-simulador.json", import.meta.url);
type Venda = Record<string, unknown> & { id: string; status: string; updated_at: string };

const ler = (): Venda[] => (existsSync(ARQUIVO) ? JSON.parse(readFileSync(ARQUIVO, "utf8")) : []);
const gravar = (v: Venda[]) => writeFileSync(ARQUIVO, JSON.stringify(v, null, 2));

const [comando, ...args] = process.argv.slice(2);
const agora = () => new Date().toISOString();

if (comando === "venda") {
  const [email, produtoId, status, nome = "Comprador Teste"] = args;
  const pago = status === "paid" || status === "approved";
  const venda: Venda = {
    id: randomUUID(),
    reference: randomUUID().slice(0, 7),
    type: "product",
    created_at: agora(),
    updated_at: agora(),
    product: { id: produtoId, name: "Produto simulado" },
    status,
    payment_method: "credit_card",
    currency: "BRL",
    customer: { id: randomUUID(), name: nome, email },
    approved_date: pago ? agora() : null,
    refunded_at: null,
    parent_order_id: null,
  };
  gravar([...ler(), venda]);
  console.log(venda.id);
} else if (comando === "status") {
  const [id, status] = args;
  const vendas = ler().map((v) =>
    v.id === id
      ? {
          ...v,
          status,
          updated_at: agora(),
          approved_date: v.approved_date ?? (status === "paid" ? agora() : null),
          refunded_at: status === "refunded" ? agora() : v.refunded_at,
        }
      : v,
  );
  gravar(vendas);
  console.log("ok");
} else if (comando === "listar") {
  console.table(ler().map((v) => ({ id: v.id, status: v.status, email: (v.customer as { email: string }).email })));
} else if (comando === "servir") {
  createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "POST" && url.pathname === "/v1/oauth/token") {
      return json(200, { access_token: `sim-${randomUUID()}`, token_type: "Bearer", expires_in: "86400", scope: "sales" });
    }
    if (!req.headers.authorization?.startsWith("Bearer ") || !req.headers["x-kiwify-account-id"]) {
      return json(401, { error: "auth_error" });
    }
    if (req.method === "GET" && url.pathname === "/v1/sales") {
      if (!url.searchParams.get("start_date") || !url.searchParams.get("end_date")) return json(400, { error: "start_date e end_date obrigatórios" });
      const tamanho = Number(url.searchParams.get("page_size") ?? 10);
      const pagina = Number(url.searchParams.get("page_number") ?? 1);
      const todas = ler();
      return json(200, {
        pagination: { count: todas.length, page_number: pagina, page_size: tamanho },
        data: todas.slice((pagina - 1) * tamanho, pagina * tamanho),
      });
    }
    const m = url.pathname.match(/^\/v1\/sales\/([\w-]+)$/);
    if (req.method === "GET" && m) {
      const v = ler().find((x) => x.id === m[1]);
      return v ? json(200, v) : json(404, { error: "not_found" });
    }
    json(404, { error: "not_found" });
  }).listen(3099, "127.0.0.1", () => console.log("Simulador Kiwify em http://127.0.0.1:3099/v1"));
} else {
  console.log("Comandos: servir | venda <email> <produto_id> <status> [nome] | status <id> <status> | listar");
}
