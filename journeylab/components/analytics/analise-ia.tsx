"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { gerarAnaliseIa, type AnaliseIa } from "@/lib/analytics/actions";

/** Análise executiva sob demanda (só indicadores agregados vão para a IA; nada é gravado). */
export function AnaliseIaPeople({ params, disponivel }: { params: { periodo?: string; de?: string; ate?: string; area?: string }; disponivel: boolean }) {
  const [analise, setAnalise] = useState<AnaliseIa | null>(null);
  const [pendente, iniciar] = useTransition();
  if (!disponivel)
    return <p className="text-sm text-muted-foreground">Análise por IA indisponível: nenhum serviço de IA está configurado nesta instalação. Os insights acima são gerados por regras e continuam valendo.</p>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await gerarAnaliseIa(params);
              if (r.erro) toast.error(r.erro);
              else setAnalise(r.analise ?? null);
            })
          }
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pendente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {analise ? "Gerar novamente" : "Gerar análise executiva"}
        </button>
        <p className="text-xs text-muted-foreground">Só indicadores agregados são enviados — nenhum nome, e-mail ou resposta individual. Revise antes de compartilhar.</p>
      </div>
      {analise && (
        <div className="flex flex-col gap-4" aria-live="polite">
          <p className="text-sm leading-relaxed whitespace-pre-line">{analise.resumo_executivo}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {analise.destaques.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-sm font-semibold">Destaques</h4>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {analise.destaques.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
            {analise.riscos.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-sm font-semibold">Riscos</h4>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {analise.riscos.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {analise.recomendacoes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <caption className="mb-2 text-left text-sm font-semibold">Recomendações</caption>
                <thead className="text-left text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="py-2 pr-3">Ação</th>
                    <th scope="col" className="py-2 pr-3">Prioridade</th>
                    <th scope="col" className="py-2 pr-3">Prazo</th>
                    <th scope="col" className="py-2">Indicador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {analise.recomendacoes.map((r) => (
                    <tr key={r.acao}>
                      <td className="py-2 pr-3">{r.acao}</td>
                      <td className="py-2 pr-3 capitalize">{r.prioridade}</td>
                      <td className="py-2 pr-3">{r.prazo}</td>
                      <td className="py-2 text-muted-foreground">{r.indicador}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
