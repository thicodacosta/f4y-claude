import { getClientesAtivos } from "@/modules/crm/queries";
import { EmpresasTable } from "@/components/crm/empresas-table";

export default async function ClientesPage() {
  const clientes = await getClientesAtivos();

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Empresas com status ativo — viram cliente quando uma oportunidade fecha como Ganha.
        </p>
      </div>
      <EmpresasTable empresas={clientes} />
    </div>
  );
}
