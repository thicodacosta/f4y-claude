import type { Metadata } from "next";
import { carregarDocumentoLegal } from "@/lib/documentos-legais";
import { PaginaLegal } from "@/components/legal/pagina-legal";

export const metadata: Metadata = { title: "Política de privacidade" };

export default async function PrivacidadePage() {
  return <PaginaLegal html={await carregarDocumentoLegal("politica-de-privacidade")} />;
}
