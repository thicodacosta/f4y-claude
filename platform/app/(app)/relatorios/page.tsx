import Link from "next/link";
import { BarChart3, ChevronRight } from "lucide-react";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_GESTAO } from "@/lib/roles";

export default async function RelatoriosPage() {
  await requirePapel(PAPEIS_GESTAO);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Visões agregadas além do Dashboard.</p>
      </div>
      <div className="flex max-w-md flex-col gap-3">
        <Link
          href="/relatorios/produtividade"
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:bg-muted"
        >
          <BarChart3 className="size-5 text-primary" />
          <div className="flex-1">
            <div className="font-semibold">Produtividade</div>
            <div className="text-sm text-muted-foreground">
              Desempenho por consultor/recrutador, heatmap de atividade e leaderboard de metas
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
