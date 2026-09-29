import { salvarVaga } from "@/lib/crm/actions";
import { STATUS_VAGA } from "@/lib/crm/normalizar";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo, Selecao } from "@/components/admin/campos";

type Vaga = {
  id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  modelo: string | null;
  equipeId: string | null;
  gestorId: string | null;
  status: string;
};

export function FormVaga({
  v,
  equipes,
  gestores,
  somenteLeitura,
}: {
  v?: Vaga;
  equipes: { id: string; nome: string }[];
  gestores: { id: string; nome: string }[];
  somenteLeitura?: boolean;
}) {
  const campos = (
    <div className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-2">
      {v && <input type="hidden" name="id" value={v.id} />}
      <Campo nome="titulo" rotulo="Título da vaga" defaultValue={v?.titulo} required className="md:col-span-2" disabled={somenteLeitura} />
      <Selecao nome="equipeId" rotulo="Equipe" defaultValue={v?.equipeId ?? ""} opcoes={[{ valor: "", rotulo: "—" }, ...equipes.map((e) => ({ valor: e.id, rotulo: e.nome }))]} disabled={somenteLeitura} />
      <Selecao
        nome="gestorId"
        rotulo="Gestor responsável"
        defaultValue={v?.gestorId ?? ""}
        opcoes={[{ valor: "", rotulo: "—" }, ...gestores.map((g) => ({ valor: g.id, rotulo: g.nome }))]}
        ajuda="Se o papel de gestor tiver acesso ao CRM, ele verá os candidatos desta vaga."
        disabled={somenteLeitura}
      />
      <Campo nome="local" rotulo="Local" defaultValue={v?.local ?? ""} disabled={somenteLeitura} />
      <Selecao
        nome="modelo"
        rotulo="Modelo de trabalho"
        defaultValue={v?.modelo ?? ""}
        opcoes={[
          { valor: "", rotulo: "—" },
          { valor: "Presencial", rotulo: "Presencial" },
          { valor: "Híbrido", rotulo: "Híbrido" },
          { valor: "Remoto", rotulo: "Remoto" },
        ]}
        disabled={somenteLeitura}
      />
      <Selecao
        nome="status"
        rotulo="Situação"
        defaultValue={v?.status ?? "aberta"}
        opcoes={Object.entries(STATUS_VAGA).map(([valor, s]) => ({ valor, rotulo: s.nome }))}
        disabled={somenteLeitura}
      />
      <Area nome="descricao" rotulo="Descrição" defaultValue={v?.descricao ?? ""} rows={5} className="md:col-span-2" disabled={somenteLeitura} />
    </div>
  );
  if (somenteLeitura) return campos;
  return <FormAcao action={salvarVaga} textoBotao={v ? "Salvar vaga" : "Criar vaga"}>{campos}</FormAcao>;
}
