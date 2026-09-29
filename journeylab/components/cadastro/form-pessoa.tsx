import { salvarColaborador } from "@/lib/organizacao/actions";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo, Interruptor, Selecao } from "@/components/admin/campos";

type Pessoa = {
  id: string;
  nome: string;
  email: string | null;
  cargo: string | null;
  equipeId: string | null;
  gestorId: string | null;
  dataAdmissao: Date | null;
  status: string;
};

export function FormPessoa({
  pessoa,
  equipes,
  gestores,
  somenteLeitura,
  onboardingAutomatico,
}: {
  pessoa?: Pessoa;
  equipes: { id: string; nome: string }[];
  gestores: { id: string; nome: string }[];
  somenteLeitura?: boolean;
  /** Organização com Onboarding ativo: oferece a criação automática no cadastro. */
  onboardingAutomatico?: boolean;
}) {
  const campos = (
    <div className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-2">
      {pessoa && <input type="hidden" name="id" value={pessoa.id} />}
      <Campo nome="nome" rotulo="Nome completo" defaultValue={pessoa?.nome} required disabled={somenteLeitura} />
      <Campo nome="email" rotulo="E-mail corporativo" type="email" defaultValue={pessoa?.email ?? ""} disabled={somenteLeitura} />
      <Campo nome="cargo" rotulo="Cargo" defaultValue={pessoa?.cargo ?? ""} disabled={somenteLeitura} />
      <Campo
        nome="dataAdmissao"
        rotulo="Data de admissão"
        type="date"
        defaultValue={pessoa?.dataAdmissao ? pessoa.dataAdmissao.toISOString().slice(0, 10) : ""}
        disabled={somenteLeitura}
      />
      <Selecao
        nome="equipeId"
        rotulo="Equipe"
        defaultValue={pessoa?.equipeId ?? ""}
        opcoes={[{ valor: "", rotulo: "Sem equipe" }, ...equipes.map((e) => ({ valor: e.id, rotulo: e.nome }))]}
        disabled={somenteLeitura}
      />
      <Selecao
        nome="gestorId"
        rotulo="Gestor direto"
        defaultValue={pessoa?.gestorId ?? ""}
        opcoes={[{ valor: "", rotulo: "Gestor da equipe / nenhum" }, ...gestores.filter((g) => g.id !== pessoa?.id).map((g) => ({ valor: g.id, rotulo: g.nome }))]}
        ajuda="Define quem vê esta pessoa como “equipe” nos módulos."
        disabled={somenteLeitura}
      />
      <Selecao
        nome="status"
        rotulo="Situação"
        defaultValue={pessoa?.status ?? "ativo"}
        opcoes={[
          { valor: "pre_admissao", rotulo: "Pré-admissão (em onboarding)" },
          { valor: "ativo", rotulo: "Ativo" },
          { valor: "desligado", rotulo: "Desligado (dados preservados)" },
        ]}
        disabled={somenteLeitura}
      />
      {!pessoa && onboardingAutomatico && (
        <div className="md:col-span-2">
          <Interruptor
            nome="criarOnboarding"
            rotulo="Criar o onboarding automaticamente"
            marcado
            ajuda="Usa a data de admissão e o template da área da pessoa (ou o padrão da organização)."
          />
        </div>
      )}
    </div>
  );
  if (somenteLeitura) return campos;
  return (
    <FormAcao action={salvarColaborador} textoBotao={pessoa ? "Salvar alterações" : "Cadastrar pessoa"}>
      {campos}
    </FormAcao>
  );
}
