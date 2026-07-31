import { getEmpresas } from "@/modules/crm/queries";
import { EmpresasTable } from "@/components/crm/empresas-table";

export default async function EmpresasPage() {
  const empresas = await getEmpresas();

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Empresas</h1>
        <p className="text-sm text-muted-foreground">
          Toda empresa com quem já houve contato — prospect ou cliente.
        </p>
      </div>
      <EmpresasTable empresas={empresas} />
    </div>
  );
}
