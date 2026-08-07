export type BarListItem = {
  id: string;
  label: string;
  value: number;
  color?: string;
};

/**
 * Lista horizontal de barras finas — usada para funis (etapas ordenadas) e
 * rankings (top empresas/consultores/tecnologias). Valor sempre exibido como
 * texto direto ao lado da barra (não só cor) — ver skill dataviz, "identity
 * is never color-alone".
 */
export function BarList({
  items,
  formatValue = (n) => n.toLocaleString("pt-BR"),
  emptyLabel = "Sem dados ainda.",
}: {
  items: BarListItem[];
  formatValue?: (value: number) => string;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {formatValue(item.value)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%`,
                background: item.color ?? "var(--chart-1)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
