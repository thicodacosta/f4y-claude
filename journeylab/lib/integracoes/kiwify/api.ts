import "server-only";

/**
 * Cliente da API pública da Kiwify — SOMENTE o que está documentado em
 * docs.kiwify.com.br (consultado em 24–25/09/2026):
 *   POST /v1/oauth/token  (form-urlencoded: client_id, client_secret) → access_token, expires_in
 *   GET  /v1/sales        (start_date, end_date obrigatórios; janela ≤ 90 dias;
 *                          page_size, page_number, updated_at_start_date,
 *                          updated_at_end_date, view_full_sale_details)
 *   GET  /v1/sales/{id}
 * Cabeçalhos: Authorization: Bearer <token> e x-kiwify-account-id. Limite: 100 req/min.
 *
 * O formato das datas de filtro NÃO está especificado na documentação —
 * isolado em `formatarDataFiltro` para ajuste no primeiro teste real.
 */

const BASE = process.env.KIWIFY_API_URL || "https://public-api.kiwify.com/v1";

/** Status documentados no filtro `status` de GET /sales. */
export const STATUS_VENDA = [
  "approved",
  "authorized",
  "chargedback",
  "paid",
  "pending",
  "pending_refund",
  "processing",
  "refunded",
  "refund_requested",
  "refused",
  "waiting_payment",
] as const;

/** Campos da venda usados pela plataforma (subconjunto do exemplo documentado). */
export type VendaKiwify = {
  id: string;
  status: string;
  type?: string;
  created_at?: string;
  updated_at?: string;
  approved_date?: string | null;
  refunded_at?: string | null;
  parent_order_id?: string | null;
  product?: { id: string; name?: string } | null;
  customer?: { name?: string; email?: string } | null;
};

type Paginada = {
  pagination?: { count?: number; page_number?: number; page_size?: number };
  data?: VendaKiwify[];
};

export function kiwifyConfigurada() {
  return Boolean(process.env.KIWIFY_ACCOUNT_ID && process.env.KIWIFY_CLIENT_ID && process.env.KIWIFY_CLIENT_SECRET);
}

export function formatarDataFiltro(d: Date) {
  return d.toISOString().slice(0, 10); // AAAA-MM-DD — a confirmar com a API real
}

// Token OAuth em memória do processo (nunca gravado em banco nem em log).
let tokenCache: { valor: string; expiraEm: number } | null = null;

async function obterToken(): Promise<string> {
  if (tokenCache && tokenCache.expiraEm > Date.now() + 60_000) return tokenCache.valor;
  const resp = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.KIWIFY_CLIENT_ID ?? "",
      client_secret: process.env.KIWIFY_CLIENT_SECRET ?? "",
    }),
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`Kiwify OAuth falhou (HTTP ${resp.status}). Verifique client_id e client_secret.`);
  const json = (await resp.json()) as { access_token?: string; expires_in?: string | number };
  if (!json.access_token) throw new Error("Kiwify OAuth não retornou access_token.");
  const segundos = Number(json.expires_in) || 3600;
  tokenCache = { valor: json.access_token, expiraEm: Date.now() + segundos * 1000 };
  return tokenCache.valor;
}

async function chamar<T>(caminho: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${caminho}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${await obterToken()}`,
        "x-kiwify-account-id": process.env.KIWIFY_ACCOUNT_ID ?? "",
      },
      cache: "no-store",
    });
    if (resp.status === 401) {
      tokenCache = null; // token expirado/revogado: renova e tenta de novo
      continue;
    }
    if (resp.status === 429 || resp.status >= 500) {
      await new Promise((r) => setTimeout(r, 1500 * (tentativa + 1)));
      continue;
    }
    if (!resp.ok) throw new Error(`Kiwify ${caminho} respondeu HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    return (await resp.json()) as T;
  }
  throw new Error(`Kiwify ${caminho}: sem resposta válida após 3 tentativas.`);
}

export async function consultarVenda(id: string) {
  return chamar<VendaKiwify>(`/sales/${encodeURIComponent(id)}`);
}

/**
 * Lista vendas atualizadas desde `atualizadasDesde` (pega reembolsos e
 * mudanças de status), dentro da janela máxima documentada de 90 dias.
 */
export async function listarVendas(atualizadasDesde: Date, agora = new Date()): Promise<VendaKiwify[]> {
  const inicio = new Date(agora.getTime() - 89 * 24 * 3600 * 1000);
  const vendas: VendaKiwify[] = [];
  const tamanho = 100;
  for (let pagina = 1; pagina <= 50; pagina++) {
    const r = await chamar<Paginada>("/sales", {
      start_date: formatarDataFiltro(inicio),
      end_date: formatarDataFiltro(agora),
      updated_at_start_date: formatarDataFiltro(atualizadasDesde < inicio ? inicio : atualizadasDesde),
      updated_at_end_date: formatarDataFiltro(agora),
      view_full_sale_details: "true",
      page_size: String(tamanho),
      page_number: String(pagina),
    });
    const lote = r.data ?? [];
    vendas.push(...lote);
    if (lote.length < tamanho) break;
  }
  return vendas;
}
