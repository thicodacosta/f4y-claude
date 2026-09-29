import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Arquivos das organizações: bucket PRIVADO, caminho sempre prefixado pelo
 * tenant (`{tenantId}/{modulo}/...`). O navegador nunca acessa o Storage
 * diretamente: o servidor checa permissão e emite URL assinada de curta
 * duração. O `tenantId` vem sempre do contexto do servidor.
 */
const BUCKET = "arquivos";
export const TAMANHO_MAXIMO = 10 * 1024 * 1024;
export const TIPOS_CURRICULO: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

let bucketPronto = false;
async function garantirBucket() {
  if (bucketPronto) return;
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: TAMANHO_MAXIMO });
    if (error && !/already exists/i.test(error.message)) throw new Error(`Storage indisponível: ${error.message}`);
  }
  bucketPronto = true;
}

function nomeSeguro(nome: string) {
  const base = nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\w.-]+/g, "_");
  return base.slice(-80) || "arquivo";
}

export async function enviarArquivo(tenantId: string, pasta: string, arquivo: File) {
  await garantirBucket();
  const caminho = `${tenantId}/${pasta}/${randomUUID()}-${nomeSeguro(arquivo.name)}`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(caminho, Buffer.from(await arquivo.arrayBuffer()), { contentType: arquivo.type, upsert: false });
  if (error) throw new Error(`Falha ao enviar o arquivo: ${error.message}`);
  return caminho;
}

/** URL temporária (60 s). Chamar SOMENTE depois de checar permissão e tenant. */
export async function urlTemporaria(caminho: string, nomeDownload: string) {
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUrl(caminho, 60, { download: nomeDownload });
  if (error || !data) throw new Error("Arquivo indisponível.");
  return data.signedUrl;
}

export async function removerArquivo(caminho: string) {
  await createAdminClient().storage.from(BUCKET).remove([caminho]);
}

/** Confere a assinatura do arquivo (não confia só no tipo declarado pelo navegador). */
export async function tipoRealCurriculo(arquivo: File): Promise<string | null> {
  const cabeca = new Uint8Array(await arquivo.slice(0, 8).arrayBuffer());
  const hex = [...cabeca].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.startsWith("25504446")) return "application/pdf"; // %PDF
  if (hex.startsWith("504b0304")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; // ZIP (docx)
  if (hex.startsWith("d0cf11e0")) return "application/msword"; // OLE (doc)
  return null;
}

/** Anexos de tarefas: documentos (PDF/DOC/DOCX) e imagens (PNG/JPG), conferidos pela assinatura. */
export const TIPOS_ANEXO: Record<string, string> = { ...TIPOS_CURRICULO, "image/png": "png", "image/jpeg": "jpg" };
export async function tipoRealAnexo(arquivo: File): Promise<string | null> {
  const doc = await tipoRealCurriculo(arquivo);
  if (doc) return doc;
  const cabeca = new Uint8Array(await arquivo.slice(0, 4).arrayBuffer());
  const hex = [...cabeca].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex === "89504e47") return "image/png";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  return null;
}
