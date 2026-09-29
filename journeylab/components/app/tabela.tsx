import { cn } from "@/lib/utils";

/** Tabela densa de dados (DataTable leve) — Card.md: grade de dados não usa cards. */
export function Tabela({
  colunas,
  children,
  minWidth = 640,
}: {
  colunas: string[];
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-surface">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="border-b border-border text-left">
          <tr>
            {colunas.map((c) => (
              <th key={c} scope="col" className="px-4 py-3 text-xs font-semibold tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase first:pl-5">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border [&>tr]:transition-colors [&>tr:hover]:bg-muted/50">{children}</tbody>
      </table>
    </div>
  );
}

export function Celula({
  children,
  className,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-4 py-3.5 align-middle first:pl-5", className)}>
      {children}
    </td>
  );
}

export function Vazio({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="font-semibold">{titulo}</p>
      <p className="max-w-md text-sm text-muted-foreground">{descricao}</p>
    </div>
  );
}
