import type { Metadata } from "next";
import { carregarDocumentoLegal } from "@/lib/documentos-legais";
import { PaginaLegal } from "@/components/legal/pagina-legal";

export const metadata: Metadata = { title: "Termos de uso" };

export default async function TermosPage() {
  return <PaginaLegal html={await carregarDocumentoLegal("termos-de-uso")} />;
}
