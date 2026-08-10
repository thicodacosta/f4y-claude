/**
 * Provisiona o bucket privado de documentos (propostas comerciais, contratos
 * etc. — Fase 13, reestruturação do Pipeline Comercial) no Supabase Storage.
 * Roda uma vez via `npx tsx scripts/setup-storage-bucket.ts`, não faz parte
 * do app em runtime. Idempotente — não falha se o bucket já existir.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const BUCKET = "documentos";

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existentes } = await supabase.storage.listBuckets();
  if (existentes?.some((b) => b.name === BUCKET)) {
    console.log(`Bucket "${BUCKET}" já existe.`);
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: "25MB",
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/png",
      "image/jpeg",
    ],
  });

  if (error) {
    console.error("Falha ao criar bucket:", error.message);
    process.exit(1);
  }
  console.log(`Bucket "${BUCKET}" criado (privado, 25MB, PDF/Office/imagem).`);
}

main();
