"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { salvarAcaoRetencao } from "@/lib/retencao-talentos/actions";
import { CHAVES_MOTIVO, MOTIVOS, type Motivo } from "@/lib/offboarding/motivos";
import { cn } from "@/lib/utils";

const campo = "w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const rotulo = "flex flex-col gap-1.5 text-[13px] font-semibold";

export type InicialAcao = { colaboradorId?: string; equipeId?: string; categoria?: string; origem?: string };

/** Nova ação de retenção, com o playbook do fator escolhido (sugestões clicáveis). */
export function FormAcaoRetencao({
  pessoas,
  equipes,
  responsaveis,
  podeOrganizacao,
  inicial,
}: {
  pessoas: { id: string; nome: string }[];
  equipes: { id: string; nome: string }[];
  responsaveis: { id: string; nome: string }[];
  podeOrganizacao: boolean;
  inicial: InicialAcao;
}) {
  const router = useRouter();
  const [alcance, setAlcance] = useState(inicial.colaboradorId ? "individual" : inicial.equipeId ? "equipe" : "individual");
  const [categoria, setCategoria] = useState<Motivo>(inicial.categoria && inicial.categoria in MOTIVOS ? (inicial.categoria as Motivo) : "crescimento");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [colaboradorId, setColaboradorId] = useState(inicial.colaboradorId ?? "");
  const [equipeId, setEquipeId] = useState(inicial.equipeId ?? "");
  const [responsavelId, setResponsavelId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [pendente, iniciar] = useTransition();

  return (
    <form
      id="nova-acao"
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await salvarAcaoRetencao({
            titulo,
            descricao,
            categoria,
            alcance: alcance as "individual" | "equipe" | "organizacao",
            colaboradorId,
            equipeId,
            responsavelId,
            prazo,
            origem: (["risco", "offboarding", "analytics"].includes(inicial.origem ?? "") ? inicial.origem : "manual") as "manual",
          });
          if (r.erro) {
            toast.error(r.erro);
            return;
          }
          toast.success(r.ok);
          setTitulo("");
          setDescricao("");
          router.replace("/retencao/acoes");
          router.refresh();
        });
      }}
    >
      <fieldset disabled={pendente} className="grid gap-4 sm:grid-cols-2">
        <label className={rotulo}>
          Fator de saída tratado
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as Motivo)} className={cn(campo, "h-10 font-normal")}>
            {CHAVES_MOTIVO.map((m) => (
              <option key={m} value={m}>
                {MOTIVOS[m].nome}
              </option>
            ))}
          </select>
        </label>
        <label className={rotulo}>
          Alcance
          <select value={alcance} onChange={(e) => setAlcance(e.target.value)} className={cn(campo, "h-10 font-normal")}>
            <option value="individual">Individual</option>
            <option value="equipe">Equipe</option>
            {podeOrganizacao && <option value="organizacao">Organização</option>}
          </select>
        </label>
        {alcance === "individual" && (
          <label className={cn(rotulo, "sm:col-span-2")}>
            Pessoa
            <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} required className={cn(campo, "h-10 font-normal")}>
              <option value="">Escolha…</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        {alcance === "equipe" && (
          <label className={cn(rotulo, "sm:col-span-2")}>
            Equipe
            <select value={equipeId} onChange={(e) => setEquipeId(e.target.value)} required className={cn(campo, "h-10 font-normal")}>
              <option value="">Escolha…</option>
              {equipes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={cn(rotulo, "sm:col-span-2")}>
          Ação
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={3} maxLength={160} placeholder="Ex.: Conversa de carreira e revisão do PDI" className={cn(campo, "h-10 font-normal")} />
        </label>
        <label className={cn(rotulo, "sm:col-span-2")}>
          Detalhes
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={3000} className={cn(campo, "py-2 font-normal")} placeholder="Contexto, combinados e como medir o resultado." />
        </label>
        <label className={rotulo}>
          Responsável
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className={cn(campo, "h-10 font-normal")}>
            <option value="">—</option>
            {responsaveis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label className={rotulo}>
          Prazo
          <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={cn(campo, "h-10 font-normal")} />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />} Criar ação
          </button>
        </div>
      </fieldset>
      <aside aria-label="Playbook" className="flex flex-col gap-2 rounded-lg bg-teal-soft/60 p-4 text-sm">
        <p className="flex items-center gap-1.5 font-semibold text-teal-strong">
          <Lightbulb className="size-4" aria-hidden /> Playbook: {MOTIVOS[categoria].nome}
        </p>
        <p className="text-xs text-muted-foreground">{MOTIVOS[categoria].resumo}</p>
        <ul className="flex flex-col gap-1.5">
          {MOTIVOS[categoria].acoes.map((a) => (
            <li key={a}>
              <button type="button" onClick={() => setTitulo(a)} className="w-full rounded-md bg-card px-2.5 py-2 text-left text-xs hover:shadow-surface">
                {a}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground">Clique para usar como título.</p>
      </aside>
    </form>
  );
}
