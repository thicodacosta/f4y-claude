import { cn } from "@/lib/utils";

const baseCampo =
  "w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

export function Campo({
  nome,
  rotulo,
  ajuda,
  className,
  idCampo,
  ...props
}: { nome: string; rotulo: string; ajuda?: string; idCampo?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = idCampo ?? `campo-${nome}`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-foreground/85">
        {rotulo}
      </label>
      <input id={id} name={nome} className={cn(baseCampo, "h-10")} {...props} />
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

export function Area({
  nome,
  rotulo,
  ajuda,
  className,
  idCampo,
  ...props
}: { nome: string; rotulo: string; ajuda?: string; idCampo?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = idCampo ?? `campo-${nome}`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-foreground/85">
        {rotulo}
      </label>
      <textarea id={id} name={nome} rows={3} className={cn(baseCampo, "py-2 leading-relaxed")} {...props} />
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

export function Selecao({
  nome,
  rotulo,
  opcoes,
  ajuda,
  className,
  idCampo,
  ...props
}: {
  nome: string;
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
  ajuda?: string;
  idCampo?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = idCampo ?? `campo-${nome}`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-foreground/85">
        {rotulo}
      </label>
      <select id={id} name={nome} className={cn(baseCampo, "h-10")} {...props}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

export function Marcadores({
  nome,
  rotulo,
  opcoes,
  marcados,
  className,
}: {
  nome: string;
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
  marcados: string[];
  className?: string;
}) {
  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      <legend className="mb-1.5 text-[13px] font-semibold text-foreground/85">{rotulo}</legend>
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {opcoes.map((o) => (
          <label key={o.valor} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name={nome}
              value={o.valor}
              defaultChecked={marcados.includes(o.valor)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
            />
            {o.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Interruptor({
  nome,
  rotulo,
  marcado,
  ajuda,
}: {
  nome: string;
  rotulo: string;
  marcado?: boolean;
  ajuda?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" name={nome} defaultChecked={marcado} className="mt-0.5 size-4 accent-[var(--primary)]" />
      <span>
        <span className="font-medium">{rotulo}</span>
        {ajuda && <span className="block text-xs text-muted-foreground">{ajuda}</span>}
      </span>
    </label>
  );
}

/** Botão de submit para Server Actions simples (formularios inline). */
export function BotaoAcao({
  children,
  variante = "outline",
  className,
}: {
  children: React.ReactNode;
  variante?: "primario" | "outline" | "perigo";
  className?: string;
}) {
  const estilos = {
    primario: "bg-primary text-primary-foreground hover:bg-primary/85",
    outline: "border border-border bg-background hover:bg-muted",
    perigo: "bg-destructive/10 text-destructive hover:bg-destructive/20",
  } as const;
  return (
    <button
      type="submit"
      className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors", estilos[variante], className)}
    >
      {children}
    </button>
  );
}
