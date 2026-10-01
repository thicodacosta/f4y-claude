"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { atualizarDesligamento, registrarDesligamento } from "@/lib/offboarding/actions";
import { CHAVES_MOTIVO, MOTIVOS, TIPO_DESLIGAMENTO, type Motivo, type TipoDesligamento } from "@/lib/offboarding/motivos";
import { cn } from "@/lib/utils";

const campo = "w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const rotulo = "flex flex-col gap-1.5 text-[13px] font-semibold";

export type DadosDesligamento = {
  tipo: TipoDesligamento;
  voluntario: boolean;
  motivoDeclarado: Motivo;
  observacao: string;
  perdaLamentada: boolean;
  elegivelRecontratacao: "" | "sim" | "nao";
  emailContato: string;
};

/** Registro (novo: escolhe pessoa e data) ou edição do desligamento. */
export function FormDesligamento({
  id,
  pessoas,
  inicial,
  colaboradorInicial,
  hoje,
  somenteLeitura,
}: {
  id?: string;
  pessoas?: { id: string; nome: string; detalhe: string; data?: string }[];
  inicial?: DadosDesligamento;
  colaboradorInicial?: string;
  hoje: string;
  somenteLeitura?: boolean;
}) {
  const router = useRouter();
  const [colaboradorId, setColaboradorId] = useState(colaboradorInicial ?? "");
  const [data, setData] = useState(pessoas?.find((p) => p.id === colaboradorInicial)?.data ?? hoje);
  const [d, setD] = useState<DadosDesligamento>(
    inicial ?? { tipo: "pedido_demissao", voluntario: true, motivoDeclarado: "crescimento", observacao: "", perdaLamentada: false, elegivelRecontratacao: "", emailContato: "" },
  );
  const [pendente, iniciar] = useTransition();
  const set = (p: Partial<DadosDesligamento>) => setD((x) => ({ ...x, ...p }));

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const comum = { ...d, elegivelRecontratacao: d.elegivelRecontratacao === "" ? null : d.elegivelRecontratacao === "sim" };
        iniciar(async () => {
          const r = id ? await atualizarDesligamento(id, comum) : await registrarDesligamento({ ...comum, colaboradorId, data });
          if (r.erro) {
            toast.error(r.erro);
            return;
          }
          toast.success(r.ok);
          if (!id && r.id) router.push(`/offboarding/${r.id}`);
          else router.refresh();
        });
      }}
    >
      <fieldset disabled={somenteLeitura || pendente} className="contents">
        {!id && (
          <>
            <label className={cn(rotulo, "sm:col-span-2")}>
              Colaborador
              <select
                value={colaboradorId}
                onChange={(e) => {
                  setColaboradorId(e.target.value);
                  const p = pessoas?.find((x) => x.id === e.target.value);
                  if (p?.data) setData(p.data);
                }}
                required
                className={cn(campo, "h-10 font-normal")}
              >
                <option value="">Escolha a pessoa…</option>
                {pessoas?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {p.detalhe}
                  </option>
                ))}
              </select>
            </label>
            <label className={rotulo}>
              Data do desligamento
              <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} required className={cn(campo, "h-10 font-normal")} />
            </label>
          </>
        )}
        <label className={rotulo}>
          Tipo de desligamento
          <select
            value={d.tipo}
            onChange={(e) => {
              const tipo = e.target.value as TipoDesligamento;
              set({ tipo, voluntario: TIPO_DESLIGAMENTO[tipo].voluntario });
            }}
            className={cn(campo, "h-10 font-normal")}
          >
            {Object.entries(TIPO_DESLIGAMENTO).map(([v, t]) => (
              <option key={v} value={v}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1.5 text-[13px] font-semibold">
          <legend className="mb-1.5">Iniciativa</legend>
          <div className="flex gap-2 font-normal">
            {[
              { v: true, r: "Do colaborador (voluntária)" },
              { v: false, r: "Da empresa (involuntária)" },
            ].map((o) => (
              <label key={String(o.v)} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50", d.voluntario === o.v ? "border-teal bg-teal-soft font-medium" : "border-border")}>
                <input type="radio" name="voluntario" checked={d.voluntario === o.v} onChange={() => set({ voluntario: o.v })} className="sr-only" />
                {o.r}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={rotulo}>
          Motivo informado
          <select value={d.motivoDeclarado} onChange={(e) => set({ motivoDeclarado: e.target.value as Motivo })} className={cn(campo, "h-10 font-normal")}>
            {CHAVES_MOTIVO.map((m) => (
              <option key={m} value={m}>
                {MOTIVOS[m].nome}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-muted-foreground">O que foi dito no desligamento. O motivo real vem da entrevista.</span>
        </label>
        <label className={cn(rotulo, "sm:col-span-2")}>
          Observações do RH
          <textarea value={d.observacao} onChange={(e) => set({ observacao: e.target.value })} rows={3} maxLength={3000} className={cn(campo, "py-2 font-normal")} />
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={d.perdaLamentada} onChange={(e) => set({ perdaLamentada: e.target.checked })} className="mt-0.5 size-4 accent-[var(--teal)]" />
          <span>
            <span className="font-semibold">Perda lamentada</span>
            <span className="block text-xs text-muted-foreground">A empresa gostaria de ter evitado esta saída (talento, conhecimento crítico, difícil reposição).</span>
          </span>
        </label>
        <label className={rotulo}>
          Elegível para recontratação
          <select value={d.elegivelRecontratacao} onChange={(e) => set({ elegivelRecontratacao: e.target.value as DadosDesligamento["elegivelRecontratacao"] })} className={cn(campo, "h-10 font-normal")}>
            <option value="">Não avaliado</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </label>
        <label className={cn(rotulo, "sm:col-span-2")}>
          E-mail pessoal para a entrevista
          <input type="email" value={d.emailContato} onChange={(e) => set({ emailContato: e.target.value })} maxLength={200} placeholder="nome@email.com" className={cn(campo, "h-10 font-normal")} />
          <span className="text-xs font-normal text-muted-foreground">O e-mail corporativo costuma ser desativado na saída. Usado só para enviar o link da entrevista.</span>
        </label>
      </fieldset>
      {!somenteLeitura && (
        <div className="sm:col-span-2">
          <button type="submit" disabled={pendente} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />} {id ? "Salvar alterações" : "Registrar desligamento"}
          </button>
        </div>
      )}
    </form>
  );
}
