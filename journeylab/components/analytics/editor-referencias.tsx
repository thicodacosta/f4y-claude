"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { salvarReferencias } from "@/lib/analytics/actions";
import { CHAVES_REFERENCIA, REFERENCIAS, type ChaveReferencia, type ConfigAnalytics } from "@/lib/analytics/referencias";

const campo = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70";

/** Referências de comparação + premissas de custo. Campo vazio = valor inicial do produto. */
export function EditorReferencias({ inicial, somenteLeitura }: { inicial: ConfigAnalytics; somenteLeitura: boolean }) {
  const [valores, setValores] = useState<Record<string, string>>(Object.fromEntries(CHAVES_REFERENCIA.map((k) => [k, inicial.valores[k]?.toString() ?? ""])));
  const [salario, setSalario] = useState(inicial.salarioMedioMensal?.toString() ?? "");
  const [meses, setMeses] = useState(inicial.mesesCustoReposicao?.toString() ?? "");
  const [setor, setSetor] = useState(inicial.setor ?? "");
  const [fonte, setFonte] = useState(inicial.fonte ?? "");
  const [pendente, iniciar] = useTransition();
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const payload = {
          valores: Object.fromEntries(CHAVES_REFERENCIA.map((k) => [k, num(valores[k])]).filter(([, v]) => v !== null)),
          salarioMedioMensal: num(salario),
          mesesCustoReposicao: num(meses),
          setor: setor.trim() || null,
          fonte: fonte.trim() || null,
        };
        iniciar(async () => {
          const r = await salvarReferencias(JSON.stringify(payload));
          if (r.erro) toast.error(r.erro);
          else toast.success(r.ok);
        });
      }}
    >
      <fieldset disabled={somenteLeitura || pendente} className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Setor de comparação
            <input value={setor} onChange={(e) => setSetor(e.target.value)} maxLength={80} placeholder="Ex.: Tecnologia · 200 a 500 pessoas" className={`${campo} font-normal`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Fonte das referências
            <input value={fonte} onChange={(e) => setFonte(e.target.value)} maxLength={200} placeholder="Ex.: Pesquisa salarial 2026 da consultoria X" className={`${campo} font-normal`} />
          </label>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">Indicador</th>
                <th scope="col" className="px-4 py-3">Valor inicial</th>
                <th scope="col" className="px-4 py-3">Sua referência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {CHAVES_REFERENCIA.map((k: ChaveReferencia) => (
                <tr key={k}>
                  <td className="px-4 py-3">
                    <label htmlFor={`ref-${k}`} className="font-medium">
                      {REFERENCIAS[k].nome}
                    </label>
                    <span className="block text-xs text-muted-foreground">
                      {REFERENCIAS[k].ajuda} {REFERENCIAS[k].menorMelhor ? "Quanto menor, melhor." : "Quanto maior, melhor."}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {REFERENCIAS[k].padrao} {REFERENCIAS[k].unidade}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <input
                        id={`ref-${k}`}
                        inputMode="decimal"
                        value={valores[k]}
                        onChange={(e) => setValores((v) => ({ ...v, [k]: e.target.value }))}
                        placeholder={String(REFERENCIAS[k].padrao)}
                        className={`${campo} w-28`}
                      />
                      <span className="text-xs text-muted-foreground">{REFERENCIAS[k].unidade}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Salário médio mensal (R$)
            <input inputMode="decimal" value={salario} onChange={(e) => setSalario(e.target.value)} placeholder="Opcional" className={`${campo} font-normal`} />
            <span className="text-xs font-normal text-muted-foreground">Usado só para estimar o custo do turnover (agregado).</span>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Custo de reposição por saída (em salários)
            <input inputMode="decimal" value={meses} onChange={(e) => setMeses(e.target.value)} placeholder="Ex.: 6" className={`${campo} font-normal`} />
            <span className="text-xs font-normal text-muted-foreground">Recrutamento, integração e produtividade perdida. Estudos costumam citar de meio a dois salários anuais conforme o cargo.</span>
          </label>
        </div>
      </fieldset>
      {!somenteLeitura && (
        <div>
          <button type="submit" disabled={pendente} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar referências
          </button>
        </div>
      )}
    </form>
  );
}
