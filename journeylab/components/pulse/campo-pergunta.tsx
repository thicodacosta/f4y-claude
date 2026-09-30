"use client";

import { Star } from "lucide-react";
import { faixa, LIKERT, type PerguntaDef, type ValorResposta } from "@/lib/pulse/perguntas";
import { cn } from "@/lib/utils";

const EMOJI = ["😞", "🙁", "😐", "🙂", "😄"];
const BOTAO = "flex items-center justify-center rounded-md border border-border text-sm font-medium transition-colors hover:bg-muted has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50";
const ATIVO = "border-primary bg-primary text-primary-foreground hover:bg-primary";

type Props = { p: PerguntaDef; nome: string; valor: ValorResposta | undefined; onChange: (v: ValorResposta | undefined) => void };

/** Estrelas acessíveis (rádios com rótulo "N de M estrelas"). */
function Estrelas({ nome, max, valor, onChange, rotulo }: { nome: string; max: number; valor: number | undefined; onChange: (v: number) => void; rotulo: string }) {
  return (
    <fieldset className="flex gap-1">
      <legend className="sr-only">{rotulo}</legend>
      {Array.from({ length: max }, (_, i) => i + 1).map((v) => (
        <label key={v} className="cursor-pointer rounded p-0.5 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
          <input type="radio" name={nome} value={v} checked={valor === v} onChange={() => onChange(v)} className="sr-only" aria-label={`${v} de ${max} estrelas`} />
          <Star className={cn("size-7", valor !== undefined && v <= valor ? "fill-warning text-warning" : "text-muted-foreground")} aria-hidden />
        </label>
      ))}
    </fieldset>
  );
}

function Numeros({ nome, min, max, valor, onChange, cor, rotulo }: { nome: string; min: number; max: number; valor: number | undefined; onChange: (v: number) => void; cor?: (v: number) => string; rotulo: string }) {
  const n = max - min + 1;
  return (
    <fieldset className={cn("grid gap-1.5", n > 6 ? "grid-cols-6 sm:grid-cols-11" : "grid-cols-5")} style={n <= 11 && n > 6 ? undefined : undefined}>
      <legend className="sr-only">{rotulo}</legend>
      {Array.from({ length: n }, (_, i) => min + i).map((v) => (
        <label key={v} className={cn(BOTAO, "h-11 cursor-pointer tabular-nums", valor === v ? (cor ? cor(v) + " text-white" : ATIVO) : "")}>
          <input type="radio" name={nome} value={v} checked={valor === v} onChange={() => onChange(v)} className="sr-only" />
          {v}
        </label>
      ))}
    </fieldset>
  );
}

const corNps = (v: number) => (v <= 6 ? "border-destructive bg-destructive" : v <= 8 ? "border-warning bg-warning" : "border-success bg-success");

export function CampoPergunta({ p, nome, valor, onChange }: Props) {
  const f = faixa(p);
  const num = typeof valor === "number" ? valor : typeof valor === "string" && valor !== "" && !isNaN(Number(valor)) ? Number(valor) : undefined;
  const matriz = (valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {}) as Record<string, string | number>;
  const setMatriz = (linha: number, v: string | number) => {
    const novo: Record<string, string | number> = { ...matriz, [String(linha)]: v };
    if (v === "") delete novo[String(linha)];
    onChange(Object.keys(novo).length ? novo : undefined);
  };
  const rotulosEscala = (p.scaleMinLabel || p.scaleMaxLabel) && (
    <p className="mt-1.5 flex justify-between text-xs text-muted-foreground">
      <span>{p.scaleMinLabel}</span>
      <span>{p.scaleMaxLabel}</span>
    </p>
  );

  switch (p.type) {
    case "multiple_choice_single":
    case "multiple_choice_multiple": {
      const multi = p.type === "multiple_choice_multiple";
      const selecionados = Array.isArray(valor) ? valor : typeof valor === "string" ? [valor] : [];
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{p.text}</legend>
          {(p.options ?? []).map((o) => {
            const marcado = selecionados.includes(o.id);
            return (
              <label key={o.id} className={cn(BOTAO, "cursor-pointer justify-start gap-3 px-3 py-2.5 text-left", marcado && "border-primary bg-teal-soft")}>
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={nome}
                  value={o.id}
                  checked={marcado}
                  onChange={(e) => (multi ? onChange(e.target.checked ? [...selecionados, o.id] : selecionados.filter((x) => x !== o.id)) : onChange(o.id))}
                  className="size-4 accent-[var(--primary)]"
                />
                {o.label}
              </label>
            );
          })}
          {multi && <p className="text-xs text-muted-foreground">Você pode marcar mais de uma opção.</p>}
        </fieldset>
      );
    }
    case "dropdown":
      return (
        <select
          aria-label={p.text}
          name={nome}
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm sm:w-80"
        >
          <option value="">Selecione…</option>
          {(p.options ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "image_choice":
      return (
        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <legend className="sr-only">{p.text}</legend>
          {(p.options ?? []).map((o) => (
            <label key={o.id} className={cn("cursor-pointer overflow-hidden rounded-lg border-2 border-border has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50", valor === o.id && "border-primary")}>
              <input type="radio" name={nome} value={o.id} checked={valor === o.id} onChange={() => onChange(o.id)} className="sr-only" />
              {o.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.imageUrl} alt="" className="aspect-video w-full bg-muted object-cover" />
              ) : (
                <span className="block aspect-video w-full bg-muted" />
              )}
              <span className="block px-3 py-2 text-sm font-medium">{o.label}</span>
            </label>
          ))}
        </fieldset>
      );
    case "boolean":
      return (
        <fieldset className="grid w-full grid-cols-2 gap-2 sm:w-72">
          <legend className="sr-only">{p.text}</legend>
          {[
            ["sim", "Sim"],
            ["nao", "Não"],
          ].map(([v, r]) => (
            <label key={v} className={cn(BOTAO, "h-11 cursor-pointer", valor === v && ATIVO)}>
              <input type="radio" name={nome} value={v} checked={valor === v} onChange={() => onChange(v)} className="sr-only" />
              {r}
            </label>
          ))}
        </fieldset>
      );
    case "nps":
      return (
        <div>
          <Numeros nome={nome} min={0} max={10} valor={num} onChange={onChange} cor={corNps} rotulo={p.text} />
          <p className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>0 · {p.scaleMinLabel || "Nada provável"}</span>
            <span>10 · {p.scaleMaxLabel || "Muito provável"}</span>
          </p>
        </div>
      );
    case "star_rating":
      return <Estrelas nome={nome} max={f.max} valor={num} onChange={onChange} rotulo={p.text} />;
    case "scale":
      return (
        <div>
          <Numeros nome={nome} min={f.min} max={f.max} valor={num} onChange={onChange} rotulo={p.text} />
          {rotulosEscala}
        </div>
      );
    case "slider":
      return (
        <div className="max-w-md">
          <div className="flex items-center gap-3">
            <input
              type="range"
              aria-label={p.text}
              min={f.min}
              max={f.max}
              step={1}
              value={num ?? Math.round((f.min + f.max) / 2)}
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
            <output className="w-10 text-right font-heading text-lg font-bold tabular-nums">{num ?? "—"}</output>
          </div>
          <p className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>
              {f.min} {p.scaleMinLabel}
            </span>
            <span>
              {f.max} {p.scaleMaxLabel}
            </span>
          </p>
          {num === undefined && <p className="text-xs text-muted-foreground">Arraste para responder.</p>}
        </div>
      );
    case "likert":
      return (
        <fieldset className="grid grid-cols-5 gap-1.5">
          <legend className="sr-only">{p.text}</legend>
          {LIKERT.map((r, i) => (
            <label key={r} className={cn(BOTAO, "cursor-pointer flex-col gap-1 px-1 py-2 text-center text-[11px] leading-tight sm:text-xs", num === i + 1 && "border-primary bg-teal-soft")}>
              <input type="radio" name={nome} value={i + 1} checked={num === i + 1} onChange={() => onChange(i + 1)} className="sr-only" />
              <span className="text-xl" aria-hidden>
                {EMOJI[i]}
              </span>
              {r}
            </label>
          ))}
        </fieldset>
      );
    case "matrix_multiple_choice":
    case "matrix_star":
    case "matrix_scale":
    case "matrix_text":
      return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            {p.type === "matrix_multiple_choice" && (
              <thead>
                <tr>
                  <th className="p-2" />
                  {(p.matrixColumns ?? []).map((c) => (
                    <th key={c} scope="col" className="p-2 text-center text-xs font-medium text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-border">
              {(p.matrixRows ?? []).map((linha, i) => (
                <tr key={i}>
                  <th scope="row" className="p-2 text-left font-medium">
                    {linha}
                  </th>
                  {p.type === "matrix_multiple_choice" &&
                    (p.matrixColumns ?? []).map((c, j) => (
                      <td key={c} className="p-2 text-center">
                        <input type="radio" name={`${nome}_${i}`} aria-label={`${linha}: ${c}`} checked={String(matriz[i]) === String(j)} onChange={() => setMatriz(i, j)} className="size-4 accent-[var(--primary)]" />
                      </td>
                    ))}
                  {p.type === "matrix_star" && (
                    <td className="p-2">
                      <Estrelas nome={`${nome}_${i}`} max={f.max} valor={typeof matriz[i] === "number" ? (matriz[i] as number) : undefined} onChange={(v) => setMatriz(i, v)} rotulo={linha} />
                    </td>
                  )}
                  {p.type === "matrix_scale" && (
                    <td className="p-2">
                      <select aria-label={linha} value={matriz[i] ?? ""} onChange={(e) => setMatriz(i, e.target.value === "" ? "" : Number(e.target.value))} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
                        <option value="">—</option>
                        {Array.from({ length: f.max - f.min + 1 }, (_, k) => f.min + k).map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  {p.type === "matrix_text" && (
                    <td className="p-2">
                      <input aria-label={linha} maxLength={500} value={String(matriz[i] ?? "")} onChange={(e) => setMatriz(i, e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "short_text":
      return (
        <input
          aria-label={p.text}
          maxLength={200}
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      );
    case "long_text":
      return (
        <div>
          <textarea
            aria-label={p.text}
            rows={4}
            maxLength={2000}
            value={typeof valor === "string" ? valor : ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <p className="text-xs text-muted-foreground">Evite nomes, datas ou detalhes que possam identificar você ou colegas.</p>
        </div>
      );
  }
}

/** A pergunta foi respondida (para progresso e validação no cliente)? */
export function respondida(p: PerguntaDef, v: ValorResposta | undefined) {
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") {
    const n = Object.keys(v).length;
    return p.type === "matrix_text" ? n > 0 : n >= (p.matrixRows ?? []).length;
  }
  return true;
}
