"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { salvarVagaCarreiras } from "@/lib/carreiras/actions";
import { MODALIDADE, TIPO_CONTRATACAO } from "@/lib/carreiras/regras";
import { PRIORIDADES } from "@/lib/crm/pipeline";
import { cn } from "@/lib/utils";

export type VagaForm = {
  id?: string;
  titulo: string;
  descricao: string;
  requisitos: string;
  local: string;
  modelo: string;
  tipoContratacao: string;
  equipeId: string;
  gestorId: string;
  prioridade: string;
  prazoFechamento: string;
  posicoes: string;
};

const campo = "w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70";
const rotulo = "flex flex-col gap-1.5 text-[13px] font-semibold";

export function FormVagaCarreiras({
  inicial,
  equipes,
  gestores,
  somenteLeitura,
}: {
  inicial?: VagaForm;
  equipes: { id: string; nome: string }[];
  gestores: { id: string; nome: string }[];
  somenteLeitura?: boolean;
}) {
  const router = useRouter();
  const [d, setD] = useState<VagaForm>(
    inicial ?? { titulo: "", descricao: "", requisitos: "", local: "", modelo: "", tipoContratacao: "", equipeId: "", gestorId: "", prioridade: "media", prazoFechamento: "", posicoes: "1" },
  );
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const set = (p: Partial<VagaForm>) => setD((x) => ({ ...x, ...p }));

  return (
    <form
      className="grid gap-4 lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        iniciar(async () => {
          const r = await salvarVagaCarreiras(d);
          if (r.erro) {
            setErro(r.erro);
            toast.error(r.erro);
            return;
          }
          toast.success(r.ok ?? "Vaga salva.");
          if (!d.id) router.push(`/pagina-carreiras/vagas/${r.id}`);
          else router.refresh();
        });
      }}
    >
      <fieldset disabled={somenteLeitura || pendente} className="contents">
        <label className={cn(rotulo, "lg:col-span-2")}>
          Título da vaga
          <input name="titulo" required maxLength={120} value={d.titulo} onChange={(e) => set({ titulo: e.target.value })} className={cn(campo, "h-10 font-normal")} />
        </label>
        <label className={cn(rotulo, "lg:col-span-2")}>
          Descrição
          <textarea name="descricao" rows={6} maxLength={8000} value={d.descricao} onChange={(e) => set({ descricao: e.target.value })} className={cn(campo, "py-2 font-normal")} placeholder="Contexto, responsabilidades e o que a pessoa vai encontrar." />
        </label>
        <label className={cn(rotulo, "lg:col-span-2")}>
          Requisitos
          <textarea name="requisitos" rows={4} maxLength={5000} value={d.requisitos} onChange={(e) => set({ requisitos: e.target.value })} className={cn(campo, "py-2 font-normal")} placeholder="Um requisito por linha." />
        </label>
        <label className={rotulo}>
          Localização
          <input name="local" maxLength={120} value={d.local} onChange={(e) => set({ local: e.target.value })} className={cn(campo, "h-10 font-normal")} placeholder="Ex.: São Paulo/SP" />
        </label>
        <label className={rotulo}>
          Modalidade de trabalho
          <select name="modelo" value={d.modelo} onChange={(e) => set({ modelo: e.target.value })} className={cn(campo, "h-10 font-normal")}>
            <option value="">Não informada</option>
            {Object.entries(MODALIDADE).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className={rotulo}>
          Tipo de contratação
          <select name="tipoContratacao" value={d.tipoContratacao} onChange={(e) => set({ tipoContratacao: e.target.value })} className={cn(campo, "h-10 font-normal")}>
            <option value="">Não informado</option>
            {Object.entries(TIPO_CONTRATACAO).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className={rotulo}>
          Equipe (interno)
          <select name="equipeId" value={d.equipeId} onChange={(e) => set({ equipeId: e.target.value })} className={cn(campo, "h-10 font-normal")}>
            <option value="">—</option>
            {equipes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
        <label className={rotulo}>
          Gestor da vaga (interno)
          <select name="gestorId" value={d.gestorId} onChange={(e) => set({ gestorId: e.target.value })} className={cn(campo, "h-10 font-normal")}>
            <option value="">—</option>
            {gestores.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
          <label className={rotulo}>
            Prioridade
            <select name="prioridade" value={d.prioridade} onChange={(e) => set({ prioridade: e.target.value })} className={cn(campo, "h-10 font-normal")}>
              {Object.entries(PRIORIDADES).map(([v, p]) => (
                <option key={v} value={v}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label className={rotulo}>
            Prazo para fechar
            <input type="date" name="prazoFechamento" value={d.prazoFechamento} onChange={(e) => set({ prazoFechamento: e.target.value })} className={cn(campo, "h-10 font-normal")} />
          </label>
          <label className={rotulo}>
            Posições
            <input type="number" name="posicoes" min={1} max={999} value={d.posicoes} onChange={(e) => set({ posicoes: e.target.value })} className={cn(campo, "h-10 font-normal")} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground lg:col-span-2">Equipe, gestor, prioridade, prazo e posições são internos (Pipeline de Vagas) e não aparecem na página pública.</p>
      </fieldset>
      {erro && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive lg:col-span-2">
          {erro}
        </p>
      )}
      {!somenteLeitura && (
        <div>
          <button type="submit" disabled={pendente} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />} {d.id ? "Salvar vaga" : "Criar vaga"}
          </button>
        </div>
      )}
    </form>
  );
}
