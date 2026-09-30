import type { Item, ResultadoPergunta } from "@/lib/pulse/analise";
import { NOME_TIPO, umaCasa, type calcularEnps } from "@/lib/pulse/perguntas";
import { Selo } from "@/components/app/lista";

function Barras({ itens }: { itens: Item[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {itens.map((i) => (
        <li key={i.rotulo} className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem] items-center gap-3 text-xs">
          <span className="truncate text-muted-foreground" title={i.rotulo}>
            {i.rotulo}
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full bg-teal" style={{ width: `${i.pct}%` }} />
          </span>
          <span className="text-right tabular-nums">
            {i.pct}% <span className="text-muted-foreground">({i.n})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Textos({ textos }: { textos: string[] }) {
  if (!textos.length) return <p className="text-xs text-muted-foreground">Sem comentários.</p>;
  return (
    <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
      {textos.map((t, i) => (
        <li key={i} className="rounded-md bg-muted/60 px-3 py-2 text-sm whitespace-pre-line">
          “{t}”
        </li>
      ))}
    </ul>
  );
}

/** Medidor de eNPS (−100 a +100) em SVG semicircular. */
export function MedidorEnps({ enps }: { enps: NonNullable<ReturnType<typeof calcularEnps>> }) {
  const ang = Math.PI * (1 - (enps.enps + 100) / 200);
  const x = 100 + 80 * Math.cos(ang);
  const y = 100 - 80 * Math.sin(ang);
  const cor = enps.enps >= 50 ? "var(--success)" : enps.enps >= 0 ? "var(--warning)" : "var(--destructive)";
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 200 115" className="w-56" role="img" aria-label={`eNPS ${enps.enps}, ${enps.classe.nome}`}>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--muted)" strokeWidth="16" strokeLinecap="round" />
        <path d={`M20 100 A80 80 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`} fill="none" stroke={cor} strokeWidth="16" strokeLinecap="round" />
        <text x="100" y="92" textAnchor="middle" className="fill-foreground font-heading text-[34px] font-bold">
          {enps.enps}
        </text>
        <text x="20" y="114" textAnchor="middle" className="fill-muted-foreground text-[9px]">
          −100
        </text>
        <text x="180" y="114" textAnchor="middle" className="fill-muted-foreground text-[9px]">
          +100
        </text>
      </svg>
      <Selo tom={enps.classe.tom}>{enps.classe.nome}</Selo>
      <figcaption className="text-center text-xs text-muted-foreground tabular-nums">
        {enps.promotores} promotores · {enps.neutros} neutros · {enps.detratores} detratores
      </figcaption>
    </figure>
  );
}

export function ResultadoCartao({ r, n }: { r: ResultadoPergunta; n: number }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-surface">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold">
          {n}. {r.pergunta.text}
        </h3>
        <span className="text-xs text-muted-foreground">
          {NOME_TIPO[r.pergunta.type]} · {r.respondentes} resposta(s)
        </span>
      </div>
      {r.media !== null && (
        <p className="text-sm">
          Média <strong className="font-heading text-lg tabular-nums">{umaCasa(r.media)}</strong>
        </p>
      )}
      {r.enps && (
        <p className="text-sm">
          eNPS <strong className="font-heading text-lg tabular-nums">{r.enps.enps}</strong> <Selo tom={r.enps.classe.tom}>{r.enps.classe.nome}</Selo>
        </p>
      )}
      {r.forma === "textos" && <Textos textos={r.textos} />}
      {(r.forma === "opcoes" || r.forma === "numerico") && <Barras itens={r.itens} />}
      {(r.forma === "matriz_opcoes" || r.forma === "matriz_numerica") && (
        <div className="flex flex-col gap-4">
          {r.linhas.map((l) => (
            <div key={l.rotulo} className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">
                {l.rotulo}
                {l.media !== null && <span className="ml-2 text-xs text-muted-foreground tabular-nums">média {umaCasa(l.media)}</span>}
              </p>
              {r.pergunta.type === "matrix_text" ? <Textos textos={l.textos} /> : <Barras itens={l.itens} />}
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
