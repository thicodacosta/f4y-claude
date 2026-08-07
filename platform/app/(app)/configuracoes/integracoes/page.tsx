import { Suspense } from "react";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_INTERNOS } from "@/lib/roles";
import { getMinhasIntegracoes } from "@/modules/integracoes/queries";
import { IntegracoesView } from "@/components/configuracoes/integracoes-view";

export default async function IntegracoesPage() {
  await requirePapel(PAPEIS_INTERNOS);
  const integracoes = await getMinhasIntegracoes();

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Integrações</h1>
        <p className="text-sm text-muted-foreground">
          Conecte suas próprias contas — cada e-mail ou mensagem enviado sai da sua conta pessoal, não de um número
          ou caixa compartilhada da Find4You.
        </p>
      </div>
      <Suspense fallback={null}>
        <IntegracoesView integracoes={integracoes} />
      </Suspense>
    </div>
  );
}
