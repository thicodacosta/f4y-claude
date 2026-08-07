import { Trophy } from "lucide-react";
import { metaTipoLabel, type metaTipoValues } from "@/modules/metas/schemas";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export type MinhaMetaClient = {
  id: string;
  tipo: string;
  valorAlvo: number;
  valorAtual: number;
  percentual: number;
};

export function MinhasMetas({ metas }: { metas: MinhaMetaClient[] }) {
  if (metas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma meta definida para você este mês.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {metas.map((m) => {
        const valorFormatado = m.tipo === "comercial" ? currency.format(m.valorAtual) : String(m.valorAtual);
        const alvoFormatado = m.tipo === "comercial" ? currency.format(m.valorAlvo) : String(m.valorAlvo);
        const bateu = m.percentual >= 100;

        return (
          <div key={m.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {metaTipoLabel[m.tipo as (typeof metaTipoValues)[number]]}
                {bateu && <Trophy className="ml-1.5 inline size-3.5 text-amber-500" />}
              </span>
              <span className="text-xs text-muted-foreground">
                {valorFormatado} / {alvoFormatado}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, m.percentual)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
