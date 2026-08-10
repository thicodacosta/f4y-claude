import { getContatos } from "@/modules/crm/queries";
import { serializeContato } from "@/modules/crm/serialize";
import { ContatosView } from "@/components/crm/contatos-view";

export default async function ContatosPage() {
  const contatos = await getContatos();

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Contatos</h1>
        <p className="text-sm text-muted-foreground">
          Contatos de prospecção e decisores cruzando todas as empresas — {contatos.length} no total.
        </p>
      </div>
      <ContatosView contatos={contatos.map(serializeContato)} />
    </div>
  );
}
