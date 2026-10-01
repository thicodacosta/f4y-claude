/**
 * Conteúdo editável da Página de Carreiras (puro: servidor e cliente).
 * Só texto simples (quebras de linha preservadas na exibição) — nada de HTML.
 * Imagens são referências a `midias_carreiras` (id), servidas pela rota pública
 * /carreiras/{org}/midia/{id}. Seções sem conteúdo não aparecem na página.
 */
import { z } from "zod";

const texto = (max: number) => z.string().trim().max(max).default("");
const url = z
  .string()
  .trim()
  .max(300)
  .default("")
  .refine((v) => !v || /^https:\/\/[^\s"'<>]+$/.test(v), "Use um link https://");
const imagem = z.object({ id: z.string().uuid(), alt: texto(160) }).nullable().default(null);
const lado = z.enum(["esquerda", "direita"]).default("direita");

export const conteudoSchema = z.object({
  capa: z.object({ titulo: texto(120), subtitulo: texto(300), imagem }).default({ titulo: "", subtitulo: "", imagem: null }),
  sobre: z.object({ titulo: texto(120), texto: texto(4000), imagem, lado }).default({ titulo: "", texto: "", imagem: null, lado: "direita" }),
  blocos: z.array(z.object({ titulo: texto(120), texto: texto(3000), imagem, lado })).max(6, "No máximo 6 blocos.").default([]),
  beneficios: z.object({ titulo: texto(120), itens: z.array(z.string().trim().min(1).max(200)).max(40) }).default({ titulo: "", itens: [] }),
  depoimentos: z.array(z.object({ nome: z.string().trim().min(1, "Informe o nome de quem deu o depoimento.").max(80), cargo: texto(80), texto: z.string().trim().min(1, "Escreva o depoimento.").max(1200), foto: imagem })).max(8, "No máximo 8 depoimentos.").default([]),
  galeria: z.array(z.object({ id: z.string().uuid(), alt: texto(160) })).max(12, "No máximo 12 fotos.").default([]),
  /** Chamada para o banco de talentos: aponta para uma vaga publicada (ex.: "Banco de talentos · Comercial"). */
  bancoTalentos: z.object({ ativo: z.boolean().default(false), texto: texto(300), vagaSlug: texto(120) }).default({ ativo: false, texto: "", vagaSlug: "" }),
  links: z.object({ site: url, linkedin: url, instagram: url, facebook: url }).default({ site: "", linkedin: "", instagram: "", facebook: "" }),
});

export type ConteudoPagina = z.infer<typeof conteudoSchema>;
export type ImagemRef = { id: string; alt: string };

export const CONTEUDO_VAZIO: ConteudoPagina = conteudoSchema.parse({});

/** Lê o conteúdo salvo de forma tolerante (conteúdo inválido volta ao padrão, sem quebrar a página pública). */
export function lerConteudo(bruto: unknown): ConteudoPagina {
  const r = conteudoSchema.safeParse(bruto ?? {});
  return r.success ? r.data : CONTEUDO_VAZIO;
}

/** Ids de todas as imagens referenciadas (para validar que pertencem à organização). */
export function imagensUsadas(c: ConteudoPagina) {
  return [c.capa.imagem, c.sobre.imagem, ...c.blocos.map((b) => b.imagem), ...c.depoimentos.map((d) => d.foto), ...c.galeria].filter((i): i is ImagemRef => !!i).map((i) => i.id);
}

export const TIPOS_IMAGEM: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const TAMANHO_IMAGEM = 5 * 1024 * 1024;
