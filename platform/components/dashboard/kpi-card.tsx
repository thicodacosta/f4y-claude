import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </div>
      <span className="font-mono text-2xl font-bold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
