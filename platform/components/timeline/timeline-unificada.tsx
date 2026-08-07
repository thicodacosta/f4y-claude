import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export type TimelineItemClient = {
  id: string;
  tipo: string;
  conteudo: string;
  criadoEm: string;
  autorNome: string | null;
  origem: string;
  origemLink: string;
};

export function TimelineUnificada({ itens }: { itens: TimelineItemClient[] }) {
  if (itens.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma interação registrada ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {itens.map((item) => (
        <div key={item.id} className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={item.origemLink} className="text-xs font-medium text-primary hover:underline">
              {item.origem}
            </Link>
            <span className="text-xs text-muted-foreground">{dataHora.format(new Date(item.criadoEm))}</span>
          </div>
          <p>{item.conteudo}</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{item.tipo}</Badge>
            {item.autorNome && <span className="text-xs text-muted-foreground">{item.autorNome}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
