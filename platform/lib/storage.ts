import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Bucket privado único pra documentos do CRM (propostas, contratos) — ver
 * scripts/setup-storage-bucket.ts. Privado porque passa por Server Action
 * gated por requirePapel, não pelo client Supabase direto — igual ao resto
 * do app (RLS não é a barreira real aqui, ver comentário em lib/roles.ts). */
const BUCKET = "documentos";

export async function uploadArquivo(caminho: string, arquivo: File): Promise<void> {
  const supabase = createAdminClient();
  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, buffer, { contentType: arquivo.type || "application/octet-stream", upsert: false });
  if (error) throw new Error(`Falha ao enviar arquivo: ${error.message}`);
}

/** Signed URL de leitura — o bucket é privado, então Arquivo.url guarda só
 * o caminho interno; a URL de verdade (com expiração) é gerada sob demanda
 * aqui, nunca armazenada (evita servir um link expirado). */
export async function urlAssinadaArquivo(caminho: string, expiraEmSegundos = 3600): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, expiraEmSegundos);
  if (error) return null;
  return data.signedUrl;
}

export async function removerArquivo(caminho: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.storage.from(BUCKET).remove([caminho]);
}
