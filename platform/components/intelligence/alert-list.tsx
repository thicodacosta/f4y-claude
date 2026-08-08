import Link from "next/link";
import { AlertCircle, AlertTriangle, Info, CircleAlert } from "lucide-react";
import type { AlertaIntelligence, Severidade } from "@/modules/intelligence/alerts";

const SEVERIDADE_CONFIG: Record<Severidade, { label: string; className: string; icon: typeof AlertCircle }> = {
  critico: { label: "Crítico", className: "border-destructive/30 bg-destructive/5 text-destructive", icon: CircleAlert },
  alto: { label: "Alto", className: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400", icon: AlertTriangle },
  medio: { label: "Médio", className: "border-border bg-muted/40 text-foreground", icon: AlertCircle },
  baixo: { label: "Baixo", className: "border-border bg-muted/20 text-muted-foreground", icon: Info },
};

/** Lista de alertas priorizados — nenhum outro componente do dashboard tem
 * esse formato (severidade + link de ação), por isso é novo em vez de
 * reaproveitado. Ver modules/intelligence/alerts.ts para a fonte dos dados. */
export function AlertList({ alertas }: { alertas: AlertaIntelligence[] }) {
  if (alertas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum alerta no momento.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {alertas.map((a) => {
        const config = SEVERIDADE_CONFIG[a.severidade];
        const Icon = config.icon;
        const conteudo = (
          <div className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm ${config.className}`}>
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium">{a.titulo}</span>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  {config.label}
                </span>
              </div>
              <p className="text-xs opacity-90">{a.descricao}</p>
            </div>
          </div>
        );
        return a.link ? (
          <Link key={a.id} href={a.link} className="block transition-opacity hover:opacity-80">
            {conteudo}
          </Link>
        ) : (
          <div key={a.id}>{conteudo}</div>
        );
      })}
    </div>
  );
}
