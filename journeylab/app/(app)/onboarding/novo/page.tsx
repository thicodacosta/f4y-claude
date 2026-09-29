import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { exigirModulo } from "@/lib/contexto";
import { hojeTexto } from "@/lib/datas";
import { iniciarOnboarding } from "@/lib/onboarding/actions";
import { Cartao } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Novo onboarding" };

export default async function NovoOnboardingPage() {
  const { ctx, escopo, db } = await exigirModulo("onboarding", "criar");
  if (escopo !== "todos" || ctx.suporte) redirect("/onboarding");
  const [pessoas, modelos] = await Promise.all([
    db.colaborador.findMany({
      where: { status: { not: "desligado" }, onboardings: { none: { status: "em_andamento" } } },
      select: { id: true, nome: true, cargo: true },
      orderBy: { nome: "asc" },
    }),
    db.modeloOnboarding.findMany({ where: { ativo: true }, select: { id: true, nome: true, padrao: true, area: { select: { nome: true } } }, orderBy: { nome: "asc" } }),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link href="/onboarding" className="text-sm text-muted-foreground hover:text-foreground">
        ← Onboardings
      </Link>
      <h2 className="font-heading text-2xl font-bold">Novo onboarding</h2>
      <p className="text-sm text-muted-foreground">
        Pessoas cadastradas com o módulo ativo já recebem o onboarding automaticamente. Use esta tela para quem ficou sem — cada pessoa tem no máximo um onboarding ativo.
      </p>
      <Cartao className="p-5">
        {pessoas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todas as pessoas ativas já têm um onboarding em andamento.</p>
        ) : (
          <FormAcao action={iniciarOnboarding} textoBotao="Criar onboarding">
            <Selecao
              nome="colaboradorId"
              rotulo="Pessoa"
              required
              opcoes={[{ valor: "", rotulo: "Selecione…" }, ...pessoas.map((p) => ({ valor: p.id, rotulo: p.cargo ? `${p.nome} — ${p.cargo}` : p.nome }))]}
            />
            <Selecao
              nome="modeloId"
              rotulo="Template"
              ajuda="Aplicável = o template da área da pessoa ou, na falta, o padrão da organização (30/60/90)."
              opcoes={[
                { valor: "", rotulo: "Aplicável automaticamente" },
                ...modelos.map((m) => ({ valor: m.id, rotulo: `${m.nome}${m.padrao ? " (padrão)" : ""}${m.area ? ` · ${m.area.nome}` : ""}` })),
              ]}
            />
            <Campo nome="inicio" rotulo="Data de início" type="date" defaultValue={hojeTexto()} required ajuda="Com data futura, o onboarding fica “Não iniciado” até a data chegar." />
          </FormAcao>
        )}
      </Cartao>
    </div>
  );
}
