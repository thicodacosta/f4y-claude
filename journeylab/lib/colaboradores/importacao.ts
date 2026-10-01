/**
 * Importação da base de colaboradores (CSV) — parte pura: leitura do arquivo
 * (separador ";" ou ",", aspas, BOM) e normalização das colunas. Servidor e testes.
 */

export const COLUNAS_IMPORTACAO = ["nome", "email", "cargo", "equipe", "area", "gestor_email", "data_admissao", "situacao"] as const;
export type LinhaImportacao = Partial<Record<(typeof COLUNAS_IMPORTACAO)[number], string>>;

const SINONIMOS: Record<string, (typeof COLUNAS_IMPORTACAO)[number]> = {
  nome: "nome",
  "nome completo": "nome",
  email: "email",
  "e-mail": "email",
  cargo: "cargo",
  funcao: "cargo",
  função: "cargo",
  equipe: "equipe",
  time: "equipe",
  area: "area",
  área: "area",
  departamento: "area",
  gestor: "gestor_email",
  gestor_email: "gestor_email",
  "e-mail do gestor": "gestor_email",
  "email do gestor": "gestor_email",
  admissao: "data_admissao",
  admissão: "data_admissao",
  data_admissao: "data_admissao",
  "data de admissão": "data_admissao",
  "data de admissao": "data_admissao",
  situacao: "situacao",
  situação: "situacao",
  status: "situacao",
};

/** CSV → linhas de células (RFC 4180 simplificado). */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const primeira = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (c === '"') aspas = false;
      else celula += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(celula);
      celula = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(celula);
      if (linha.some((x) => x.trim())) linhas.push(linha);
      linha = [];
      celula = "";
    } else celula += c;
  }
  linha.push(celula);
  if (linha.some((x) => x.trim())) linhas.push(linha);
  return linhas;
}

/** Cabeçalho + linhas → objetos com as colunas reconhecidas (colunas desconhecidas são ignoradas). */
export function mapearLinhas(tabela: string[][]): { linhas: LinhaImportacao[]; colunas: string[]; ignoradas: string[] } {
  const [cab, ...resto] = tabela;
  if (!cab) return { linhas: [], colunas: [], ignoradas: [] };
  const mapa = cab.map((c) => SINONIMOS[c.trim().toLowerCase()] ?? null);
  return {
    colunas: mapa.filter((x) => x !== null) as string[],
    ignoradas: cab.filter((_, i) => !mapa[i]).map((c) => c.trim()).filter(Boolean),
    linhas: resto.map((l) => {
      const o: LinhaImportacao = {};
      mapa.forEach((k, i) => {
        if (k && l[i]?.trim()) o[k] = l[i].trim();
      });
      return o;
    }),
  };
}

/** "AAAA-MM-DD" ou "DD/MM/AAAA" → "AAAA-MM-DD"; inválida → null. */
export function normalizarDataBr(v?: string) {
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const [a, m, d] = iso ? [iso[1], iso[2], iso[3]] : br ? [br[3], br[2].padStart(2, "0"), br[1].padStart(2, "0")] : [];
  if (!a) return null;
  const txt = `${a}-${m}-${d}`;
  const dt = new Date(`${txt}T00:00:00Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === txt ? txt : null;
}

export function normalizarSituacao(v?: string): "ativo" | "pre_admissao" | "desligado" | null {
  if (!v) return "ativo";
  const s = v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
  if (["ativo", "ativa"].includes(s)) return "ativo";
  if (["pre-admissao", "pre admissao", "pre_admissao", "preadmissao"].includes(s)) return "pre_admissao";
  if (["desligado", "desligada", "inativo", "inativa"].includes(s)) return "desligado";
  return null;
}
