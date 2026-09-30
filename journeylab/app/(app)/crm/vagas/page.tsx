import { redirect } from "next/navigation";

/** As vagas passaram a ser geridas na Página de Carreiras (mesmo cadastro do CRM). */
export default function VagasCrm() {
  redirect("/pagina-carreiras");
}
