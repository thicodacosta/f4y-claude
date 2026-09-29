import { salvarCandidato } from "@/lib/crm/actions";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo, Interruptor } from "@/components/admin/campos";

type Candidato = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  linkedin: string | null;
  experiencia: string | null;
  competencias: string[];
  observacoes: string | null;
  origem: string | null;
  baseLegal: string | null;
};

export function FormCandidato({ c, tags, somenteLeitura }: { c?: Candidato; tags?: string[]; somenteLeitura?: boolean }) {
  const campos = (
    <div className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      <Campo nome="nome" rotulo="Nome completo" defaultValue={c?.nome} required disabled={somenteLeitura} />
      <Campo nome="email" rotulo="E-mail" type="email" defaultValue={c?.email ?? ""} disabled={somenteLeitura} />
      <Campo nome="telefone" rotulo="Telefone" type="tel" defaultValue={c?.telefone ?? ""} disabled={somenteLeitura} />
      <Campo nome="linkedin" rotulo="LinkedIn" defaultValue={c?.linkedin ?? ""} placeholder="linkedin.com/in/…" disabled={somenteLeitura} />
      <Campo nome="cidade" rotulo="Cidade" defaultValue={c?.cidade ?? ""} disabled={somenteLeitura} />
      <Campo nome="uf" rotulo="UF" maxLength={2} defaultValue={c?.uf ?? ""} disabled={somenteLeitura} />
      <Area nome="experiencia" rotulo="Experiência (resumo)" defaultValue={c?.experiencia ?? ""} rows={4} className="md:col-span-2" disabled={somenteLeitura} />
      <Campo
        nome="competencias"
        rotulo="Competências"
        defaultValue={c?.competencias.join(", ") ?? ""}
        ajuda="Separe por vírgula."
        className="md:col-span-2"
        disabled={somenteLeitura}
      />
      <Campo nome="tags" rotulo="Tags" defaultValue={tags?.join(", ") ?? ""} ajuda="Separe por vírgula. Tags novas são criadas automaticamente." disabled={somenteLeitura} />
      <Campo nome="origem" rotulo="Origem" defaultValue={c?.origem ?? ""} placeholder="Indicação, LinkedIn, site…" disabled={somenteLeitura} />
      <Campo
        nome="baseLegal"
        rotulo="Base legal / consentimento (LGPD)"
        defaultValue={c?.baseLegal ?? ""}
        placeholder="Ex.: consentimento por e-mail em 12/09/2026"
        className="md:col-span-2"
        disabled={somenteLeitura}
      />
      <Area nome="observacoes" rotulo="Observações" defaultValue={c?.observacoes ?? ""} rows={3} className="md:col-span-2" disabled={somenteLeitura} />
      {!somenteLeitura && (
        <div className="md:col-span-2">
          <Interruptor
            nome="confirmarDuplicidade"
            rotulo="Cadastrar mesmo assim"
            ajuda="Use apenas se o sistema alertar sobre possível duplicidade e você tiver conferido que são pessoas diferentes."
          />
        </div>
      )}
    </div>
  );
  if (somenteLeitura) return campos;
  return (
    <FormAcao action={salvarCandidato} textoBotao={c ? "Salvar alterações" : "Cadastrar candidato"}>
      {campos}
    </FormAcao>
  );
}
