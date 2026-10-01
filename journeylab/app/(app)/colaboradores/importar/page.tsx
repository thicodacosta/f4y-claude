import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { exigirContexto, pode } from "@/lib/contexto";
import { CabecalhoCartao, Cartao } from "@/components/app/painel";
import { ImportarColaboradores } from "@/components/colaboradores/importar";

export const metadata: Metadata = { title: "Importar colaboradores" };

export default async function ImportarPage() {
  const ctx = await exigirContexto();
  if (pode(ctx, "cadastro", "criar") !== "todos" || pode(ctx, "cadastro", "editar") !== "todos" || ctx.suporte) redirect("/colaboradores");
  return (
    <>
      <div>
        <Link href="/colaboradores" className="text-sm text-muted-foreground hover:text-foreground">
          ← Colaboradores
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-bold">Importar base de colaboradores</h1>
      </div>
      <Cartao>
        <CabecalhoCartao titulo="Planilha CSV" descricao="Traga de uma vez as pessoas que já trabalham na empresa. Quem já existe (mesmo e-mail) é atualizado." />
        <div className="flex flex-col gap-5 px-5 pb-5">
          <ImportarColaboradores />
          <div className="text-sm text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">Colunas aceitas (cabeçalho na primeira linha, separador “;” ou “,”):</p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li><strong>nome</strong> (obrigatória), <strong>email</strong>, <strong>cargo</strong></li>
              <li><strong>equipe</strong> e <strong>area</strong> — criadas automaticamente se ainda não existirem</li>
              <li><strong>gestor_email</strong> — o gestor pode estar no mesmo arquivo</li>
              <li><strong>data_admissao</strong> — AAAA-MM-DD ou DD/MM/AAAA (base para tempo de casa, turnover e retenção)</li>
              <li><strong>situacao</strong> — ativo (padrão), pré-admissão ou desligado</li>
            </ul>
            <p className="mt-2">A importação não cria onboarding nem envia convites de acesso. Para dar acesso à plataforma, use Configurações › Usuários.</p>
          </div>
        </div>
      </Cartao>
    </>
  );
}
