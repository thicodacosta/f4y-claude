import { faixaDe, intervalosFaixas, nivelMatriz, SEVERIDADE } from "@/lib/nr1/calculo";
import { cn } from "@/lib/utils";

/** Cores por faixa, a partir dos tokens do design system. */
const COR_FAIXA = ["var(--success)", "color-mix(in oklab, var(--success) 60%, var(--warning))", "var(--warning)", "color-mix(in oklab, var(--warning) 45%, var(--destructive))", "var(--destructive)"];

export type FatorScore = { id: string; nome: string; score: number | null; respondentes: number };

/** Barras por fator (0–100), com rótulo textual da faixa — a cor nunca é a única informação. */
export function BarrasFatores({ fatores, faixas }: { fatores: FatorScore[]; faixas: number[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {fatores.map((f) => {
        const fx = f.score !== null ? faixaDe(f.score, faixas) : null;
        return (
          <li key={f.id} className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[minmax(0,16rem)_1fr_10rem] sm:items-center sm:gap-3">
            <span className="truncate font-medium" title={f.nome}>
              {f.nome}
            </span>
            {f.score !== null ? (
              <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full" style={{ width: `${Math.max(2, f.score)}%`, background: COR_FAIXA[fx!.indice] }} />
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Dados insuficientes para exibição segura</span>
            )}
            <span className="text-xs tabular-nums sm:text-right">{f.score !== null ? <><strong className="text-sm">{f.score}</strong> · {fx!.nome}</> : "—"}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Radar dos fatores (0–100). Fatores ocultos ficam no centro, marcados como “sem dados”. */
export function RadarFatores({ fatores }: { fatores: FatorScore[] }) {
  const n = fatores.length;
  if (n < 3) return null;
  const R = 110;
  const c = 150;
  const ponto = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * R * (v / 100), c + Math.sin(a) * R * (v / 100)] as const;
  };
  const poligono = fatores.map((f, i) => ponto(i, f.score ?? 0).join(",")).join(" ");
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 300 300" className="w-full max-w-sm" role="img" aria-label={`Radar de exposição: ${fatores.map((f) => `${f.nome} ${f.score ?? "sem dados"}`).join("; ")}`}>
        {[25, 50, 75, 100].map((v) => (
          <polygon key={v} points={fatores.map((_, i) => ponto(i, v).join(",")).join(" ")} fill="none" stroke="var(--border)" strokeWidth="1" />
        ))}
        {fatores.map((_, i) => {
          const [x, y] = ponto(i, 100);
          return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />;
        })}
        <polygon points={poligono} fill="color-mix(in oklab, var(--teal) 25%, transparent)" stroke="var(--teal)" strokeWidth="2" />
        {fatores.map((f, i) => {
          const [x, y] = ponto(i, 118);
          return (
            <text key={f.id} x={x} y={y} textAnchor={x < c - 5 ? "end" : x > c + 5 ? "start" : "middle"} dominantBaseline="middle" className="fill-muted-foreground text-[8px]">
              {i + 1}
            </text>
          );
        })}
      </svg>
      <figcaption className="mt-2 grid w-full grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
        {fatores.map((f, i) => (
          <span key={f.id}>
            {i + 1}. {f.nome}: <strong className="text-foreground tabular-nums">{f.score ?? "—"}</strong>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Legenda da metodologia das faixas (critérios internos do produto). */
export function LegendaFaixas({ faixas }: { faixas: number[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {intervalosFaixas(faixas).map((f, i) => (
        <li key={f.nome} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: COR_FAIXA[i] }} aria-hidden />
          {f.de}–{f.ate}: {f.nome}
        </li>
      ))}
    </ul>
  );
}

/** Matriz indicativa: exposição (colunas, 5 faixas) × severidade de referência (linhas, 3 níveis). */
export function MatrizIndicativa({ fatores, faixas }: { fatores: (FatorScore & { severidade: number })[]; faixas: number[] }) {
  const cols = intervalosFaixas(faixas);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-xs">
        <caption className="mb-2 text-left text-muted-foreground">Linhas: severidade de referência · colunas: faixa de exposição da pesquisa</caption>
        <thead>
          <tr>
            <th scope="col" className="w-28 border border-border p-2 text-left font-semibold">
              Severidade
            </th>
            {cols.map((c) => (
              <th key={c.nome} scope="col" className="border border-border p-2 text-left font-semibold">
                {c.nome}
                <span className="block font-normal text-muted-foreground">
                  {c.de}–{c.ate}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[3, 2, 1].map((sev) => (
            <tr key={sev}>
              <th scope="row" className="border border-border p-2 text-left font-semibold">
                {SEVERIDADE[sev as 1 | 2 | 3]}
              </th>
              {cols.map((_, i) => {
                const nivel = nivelMatriz(i, sev);
                const aqui = fatores.filter((f) => f.score !== null && f.severidade === sev && faixaDe(f.score, faixas).indice === i);
                return (
                  <td
                    key={i}
                    className={cn("h-16 border border-border p-2 align-top")}
                    style={{ background: `color-mix(in oklab, ${nivel.tom === "perigo" ? "var(--destructive)" : nivel.tom === "alerta" ? "var(--warning)" : "var(--success)"} ${nivel.n >= 7 ? 22 : 12}%, transparent)` }}
                  >
                    <span className="sr-only">{nivel.nome}: </span>
                    {aqui.map((f) => (
                      <span key={f.id} className="mb-1 block rounded bg-card px-1.5 py-0.5 font-medium shadow-surface">
                        {f.nome} ({f.score})
                      </span>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Evolução do score geral entre diagnósticos comparáveis (mesma metodologia). */
export function Evolucao({ pontos }: { pontos: { rotulo: string; valor: number }[] }) {
  if (pontos.length < 2) return <p className="text-sm text-muted-foreground">A evolução aparece a partir de dois diagnósticos encerrados com a mesma metodologia e resultados liberados.</p>;
  const W = 520;
  const H = 160;
  const x = (i: number) => 30 + (i * (W - 60)) / (pontos.length - 1);
  const y = (v: number) => H - 20 - (v / 100) * (H - 40);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Evolução do score indicativo geral: ${pontos.map((p) => `${p.rotulo} ${p.valor}`).join("; ")}`}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1="30" x2={W - 30} y1={y(v)} y2={y(v)} stroke="var(--border)" />
            <text x="4" y={y(v)} dominantBaseline="middle" className="fill-muted-foreground text-[9px]">
              {v}
            </text>
          </g>
        ))}
        <polyline points={pontos.map((p, i) => `${x(i)},${y(p.valor)}`).join(" ")} fill="none" stroke="var(--teal)" strokeWidth="2" />
        {pontos.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.valor)} r="4" fill="var(--teal)" />
            <text x={x(i)} y={y(p.valor) - 10} textAnchor="middle" className="fill-foreground text-[10px] font-semibold">
              {p.valor}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="flex justify-between text-xs text-muted-foreground">
        {pontos.map((p, i) => (
          <span key={i}>{p.rotulo}</span>
        ))}
      </figcaption>
    </figure>
  );
}
