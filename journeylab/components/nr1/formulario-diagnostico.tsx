"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { salvarDiagnostico } from "@/lib/nr1/actions";
import { FATORES_NR1, TIPO_DIAGNOSTICO, type TipoDiagnostico } from "@/lib/nr1/questionario";
import { FAIXAS_PADRAO, NOMES_FAIXA } from "@/lib/nr1/calculo";
import { cn } from "@/lib/utils";

export type DiagnosticoForm = {
  id?: string;
  titulo: string;
  descricao: string;
  tipo: TipoDiagnostico;
  itens: string[];
  audienciaTipo: "todos" | "departamentos" | "colaboradores";
  areaIds: string[];
  colaboradorIds: string[];
  dataInicio: string;
  encerraEm: string;
  coletarDepartamento: boolean;
  mensagemConvite: string;
  faixas: number[];
};

const campo = "w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const rotulo = "flex flex-col gap-1.5 text-[13px] font-semibold";

export function FormularioDiagnostico({
  inicial,
  departamentos,
  pessoas,
  hoje,
  minimo,
}: {
  inicial?: DiagnosticoForm;
  departamentos: { id: string; nome: string }[];
  pessoas: { id: string; nome: string; departamento: string | null }[];
  hoje: string;
  minimo: number;
}) {
  const router = useRouter();
  const [d, setD] = useState<DiagnosticoForm>(
    inicial ?? {
      titulo: "",
      descricao: "",
      tipo: "completo",
      itens: [],
      audienciaTipo: "todos",
      areaIds: [],
      colaboradorIds: [],
      dataInicio: hoje,
      encerraEm: "",
      coletarDepartamento: false,
      mensagemConvite: "",
      faixas: FAIXAS_PADRAO,
    },
  );
  const [filtro, setFiltro] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const set = (p: Partial<DiagnosticoForm>) => setD((x) => ({ ...x, ...p }));
  const alternar = (campo: "areaIds" | "colaboradorIds" | "itens", id: string) => setD((x) => ({ ...x, [campo]: x[campo].includes(id) ? x[campo].filter((v) => v !== id) : [...x[campo], id] }));
  const nItens = d.tipo === "completo" ? 50 : d.tipo === "rapido" ? 26 : d.itens.length;

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await salvarDiagnostico(JSON.stringify(d));
      if (r.erro) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success(r.ok ?? "Salvo.");
      router.push(`/nr1/${r.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-surface lg:grid-cols-2">
        <label className={cn(rotulo, "lg:col-span-2")}>
          Título
          <input value={d.titulo} maxLength={120} onChange={(e) => set({ titulo: e.target.value })} className={cn(campo, "h-10 font-normal")} placeholder="Ex.: Fatores psicossociais · 2º semestre 2026" />
        </label>
        <label className={cn(rotulo, "lg:col-span-2")}>
          Descrição (aparece na página de resposta)
          <textarea rows={3} maxLength={1500} value={d.descricao} onChange={(e) => set({ descricao: e.target.value })} className={cn(campo, "py-2 font-normal")} />
        </label>
        <label className={rotulo}>
          Início
          <input type="date" value={d.dataInicio} onChange={(e) => set({ dataInicio: e.target.value })} className={cn(campo, "h-10 font-normal")} />
        </label>
        <label className={rotulo}>
          Fim (encerra automaticamente)
          <input type="date" value={d.encerraEm} min={d.dataInicio || hoje} onChange={(e) => set({ encerraEm: e.target.value })} className={cn(campo, "h-10 font-normal")} />
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-surface">
        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="mb-2 text-[13px] font-semibold">Questionário</legend>
          {(Object.keys(TIPO_DIAGNOSTICO) as TipoDiagnostico[]).map((t) => (
            <label key={t} className={cn("flex cursor-pointer flex-col gap-1 rounded-lg border border-border p-4 text-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50", d.tipo === t && "border-primary bg-primary/5")}>
              <span className="flex items-center gap-2 font-semibold">
                <input type="radio" name="tipo" checked={d.tipo === t} onChange={() => set({ tipo: t })} className="accent-[var(--primary)]" />
                {TIPO_DIAGNOSTICO[t].nome}
              </span>
              <span className="text-xs text-muted-foreground">{TIPO_DIAGNOSTICO[t].descricao}</span>
            </label>
          ))}
        </fieldset>
        {d.tipo === "personalizado" ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">{d.itens.length} pergunta(s) escolhida(s). A pontuação de cada item (direta ou reversa) vem da biblioteca e fica visível na revisão.</p>
            {FATORES_NR1.map((f) => (
              <fieldset key={f.chave} className="rounded-md border border-border p-3">
                <legend className="px-1 text-sm font-semibold">{f.nome}</legend>
                {f.itens.map((i) => (
                  <label key={i.chave} className="flex items-start gap-2 py-1 text-sm">
                    <input type="checkbox" checked={d.itens.includes(i.chave)} onChange={() => alternar("itens", i.chave)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                    <span>
                      {i.texto} <span className="text-xs text-muted-foreground">({i.reversa ? "reversa" : "direta"})</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{nItens} perguntas da biblioteca do JourneyLab, criada para o produto (não é questionário oficial do MTE). Você revisa o questionário antes de ativar.</p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-surface">
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 text-[13px] font-semibold">Audiência</legend>
          {(
            [
              ["todos", "Todos os colaboradores ativos"],
              ["departamentos", "Departamentos selecionados"],
              ["colaboradores", "Colaboradores selecionados"],
            ] as const
          ).map(([v, r]) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name="audiencia" checked={d.audienciaTipo === v} onChange={() => set({ audienciaTipo: v })} className="accent-[var(--primary)]" /> {r}
            </label>
          ))}
        </fieldset>
        {d.audienciaTipo === "departamentos" && (
          <div className="grid gap-1.5 sm:grid-cols-3">
            {departamentos.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={d.areaIds.includes(a.id)} onChange={() => alternar("areaIds", a.id)} className="size-4 accent-[var(--primary)]" /> {a.nome}
              </label>
            ))}
          </div>
        )}
        {d.audienciaTipo === "colaboradores" && (
          <div className="flex flex-col gap-2">
            <input aria-label="Filtrar colaboradores" placeholder="Filtrar por nome" value={filtro} onChange={(e) => setFiltro(e.target.value)} className={cn(campo, "h-9")} />
            <div className="grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {pessoas
                .filter((p) => p.nome.toLowerCase().includes(filtro.toLowerCase()))
                .map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={d.colaboradorIds.includes(p.id)} onChange={() => alternar("colaboradorIds", p.id)} className="size-4 accent-[var(--primary)]" /> {p.nome}
                    {p.departamento && <span className="text-xs text-muted-foreground">· {p.departamento}</span>}
                  </label>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">{d.colaboradorIds.length} selecionado(s).</p>
          </div>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={d.coletarDepartamento} onChange={(e) => set({ coletarDepartamento: e.target.checked })} className="mt-0.5 size-4 accent-[var(--primary)]" />
          <span>
            <strong>Perguntar o departamento (opcional para quem responde)</strong> — permite resultados por departamento, exibidos só com pelo menos {minimo} respostas no grupo, com o restante
            também protegido, e apenas se a audiência tiver ao menos {minimo * 2} pessoas. O departamento nunca é inferido pelo e-mail.
          </span>
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-surface lg:grid-cols-2">
        <label className={rotulo}>
          Mensagem do convite (opcional)
          <textarea rows={4} maxLength={2000} value={d.mensagemConvite} onChange={(e) => set({ mensagemConvite: e.target.value })} className={cn(campo, "py-2 font-normal")} placeholder="Texto que acompanha o link no e-mail." />
          <span className="text-xs font-normal text-muted-foreground">O e-mail já inclui prazo, link pessoal e a explicação de privacidade.</span>
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] font-semibold">Faixas indicativas (limites superiores, 0–100)</legend>
          <p className="text-xs text-muted-foreground">Critério interno do produto para visualização — não é classificação oficial da NR-1.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {d.faixas.map((v, i) => (
              <label key={i} className="flex flex-col gap-1 text-xs font-semibold">
                {NOMES_FAIXA[i].nome} até
                <input type="number" min={1} max={99} value={v} onChange={(e) => set({ faixas: d.faixas.map((x, k) => (k === i ? Number(e.target.value) : x)) })} className={cn(campo, "h-9 font-normal")} />
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Acima de {d.faixas[3]}: {NOMES_FAIXA[4].nome.toLowerCase()}.</p>
        </fieldset>
      </section>

      {erro && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      <div>
        <button type="button" onClick={salvar} disabled={pendente} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />} {d.id ? "Salvar rascunho" : "Criar rascunho"}
        </button>
      </div>
    </div>
  );
}
