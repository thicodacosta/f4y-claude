"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Activity, ArrowDown, ArrowUp, Building2, ClipboardList, DoorOpen, FilePlus2, Gauge, Loader2, Plus, Trash2, Users, type LucideIcon } from "lucide-react";
import { salvarPesquisaWizard } from "@/lib/pulse/actions";
import { COM_LINHAS, COM_OPCOES, configPadrao, NOME_TIPO, perguntasSchema, TIPOS, type PerguntaDef, type TipoPergunta, type ValorResposta } from "@/lib/pulse/perguntas";
import { CampoPergunta } from "./campo-pergunta";
import { cn } from "@/lib/utils";

export type ModeloCliente = { id: string; nome: string; slug: string; descricao: string | null; icone: string | null; cor: string | null; perguntas: PerguntaDef[]; daEmpresa: boolean };
type Config = {
  titulo: string;
  descricao: string;
  anonima: boolean;
  audienciaTipo: "todos" | "departamentos" | "equipes" | "colaboradores";
  areaIds: string[];
  equipeIds: string[];
  colaboradorIds: string[];
  dataInicio: string;
  encerraEm: string;
  linkAberto: boolean;
};
type Inicial = Config & { id: string; perguntas: PerguntaDef[] };

const ICONES: Record<string, LucideIcon> = { Gauge, Activity, Building2, DoorOpen, Users, ClipboardList };
const campo = "w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
let seq = 0;
const novoId = () => `q${Date.now().toString(36)}${(seq++).toString(36)}`;
const linhasDe = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);

function EditorPergunta({ p, i, total, alterar, remover, mover }: { p: PerguntaDef; i: number; total: number; alterar: (p: PerguntaDef) => void; remover: () => void; mover: (d: -1 | 1) => void }) {
  const [previa, setPrevia] = useState<ValorResposta | undefined>();
  const set = (parcial: Partial<PerguntaDef>) => alterar({ ...p, ...parcial });
  return (
    <li className="rounded-lg border border-border bg-card shadow-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-md bg-muted text-xs font-bold tabular-nums">{i + 1}</span>
        <select
          aria-label={`Tipo da pergunta ${i + 1}`}
          value={p.type}
          onChange={(e) => {
            const tipo = e.target.value as TipoPergunta;
            alterar({ id: p.id, text: p.text, required: p.required, order: p.order, type: tipo, ...configPadrao(tipo) });
            setPrevia(undefined);
          }}
          className={cn(campo, "h-9 w-auto")}
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {NOME_TIPO[t]}
            </option>
          ))}
        </select>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.required} onChange={(e) => set({ required: e.target.checked })} className="size-4 accent-[var(--primary)]" /> Obrigatória
        </label>
        <button type="button" aria-label="Mover para cima" disabled={i === 0} onClick={() => mover(-1)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30">
          <ArrowUp className="size-4" />
        </button>
        <button type="button" aria-label="Mover para baixo" disabled={i === total - 1} onClick={() => mover(1)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30">
          <ArrowDown className="size-4" />
        </button>
        <button type="button" aria-label={`Remover pergunta ${i + 1}`} onClick={remover} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Enunciado
            <input value={p.text} onChange={(e) => set({ text: e.target.value })} maxLength={300} className={cn(campo, "h-10 font-normal")} placeholder="Escreva a pergunta" />
          </label>
          {COM_OPCOES.includes(p.type) && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[13px] font-semibold">Opções</legend>
              {(p.options ?? []).map((o, k) => (
                <div key={o.id} className="flex flex-col gap-1.5 sm:flex-row">
                  <input
                    aria-label={`Opção ${k + 1}`}
                    value={o.label}
                    maxLength={120}
                    onChange={(e) => set({ options: p.options!.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })}
                    className={cn(campo, "h-9")}
                  />
                  {p.type === "image_choice" && (
                    <input
                      aria-label={`Imagem da opção ${k + 1}`}
                      value={o.imageUrl ?? ""}
                      placeholder="https://… (imagem)"
                      onChange={(e) => set({ options: p.options!.map((x) => (x.id === o.id ? { ...x, imageUrl: e.target.value } : x)) })}
                      className={cn(campo, "h-9")}
                    />
                  )}
                  <button type="button" aria-label={`Remover opção ${k + 1}`} disabled={(p.options ?? []).length <= 2} onClick={() => set({ options: p.options!.filter((x) => x.id !== o.id) })} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={(p.options ?? []).length >= 20}
                onClick={() => set({ options: [...(p.options ?? []), { id: `o${Date.now().toString(36)}`, label: `Opção ${(p.options ?? []).length + 1}`, ...(p.type === "image_choice" ? { imageUrl: "" } : {}) }] })}
                className="w-fit text-sm font-medium text-teal-strong hover:underline disabled:opacity-40"
              >
                + Adicionar opção
              </button>
            </fieldset>
          )}
          {["scale", "slider", "matrix_scale"].includes(p.type) && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Mínimo
                <input type="number" value={p.scaleMin ?? 0} onChange={(e) => set({ scaleMin: Number(e.target.value) })} className={cn(campo, "h-9")} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Máximo
                <input type="number" value={p.scaleMax ?? 5} onChange={(e) => set({ scaleMax: Number(e.target.value) })} className={cn(campo, "h-9")} />
              </label>
            </div>
          )}
          {["scale", "slider", "nps"].includes(p.type) && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Rótulo do mínimo
                <input value={p.scaleMinLabel ?? ""} maxLength={40} onChange={(e) => set({ scaleMinLabel: e.target.value })} className={cn(campo, "h-9")} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Rótulo do máximo
                <input value={p.scaleMaxLabel ?? ""} maxLength={40} onChange={(e) => set({ scaleMaxLabel: e.target.value })} className={cn(campo, "h-9")} />
              </label>
            </div>
          )}
          {(p.type === "star_rating" || p.type === "matrix_star") && (
            <label className="flex w-40 flex-col gap-1 text-xs font-semibold">
              Número de estrelas
              <input type="number" min={3} max={10} value={p.scaleMax ?? 5} onChange={(e) => set({ scaleMax: Number(e.target.value) })} className={cn(campo, "h-9")} />
            </label>
          )}
          {COM_LINHAS.includes(p.type) && (
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Linhas da matriz (uma por linha)
              <textarea rows={3} defaultValue={(p.matrixRows ?? []).join("\n")} onBlur={(e) => set({ matrixRows: linhasDe(e.target.value) })} className={cn(campo, "py-2 font-normal")} />
            </label>
          )}
          {p.type === "matrix_multiple_choice" && (
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Colunas (uma por linha)
              <textarea rows={3} defaultValue={(p.matrixColumns ?? []).join("\n")} onBlur={(e) => set({ matrixColumns: linhasDe(e.target.value) })} className={cn(campo, "py-2 font-normal")} />
            </label>
          )}
        </div>
        <div className="rounded-md border border-dashed border-input bg-muted/30 p-4">
          <p className="mb-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Prévia</p>
          <p className="mb-3 text-sm font-semibold">
            {p.text || "Enunciado da pergunta"}
            {p.required && <span className="ml-1 text-destructive">*</span>}
          </p>
          <CampoPergunta p={p} nome={`previa_${p.id}`} valor={previa} onChange={setPrevia} />
        </div>
      </div>
    </li>
  );
}

export function Assistente({
  modelos,
  departamentos,
  equipes,
  pessoas,
  inicial,
  hoje,
}: {
  modelos: ModeloCliente[];
  departamentos: { id: string; nome: string }[];
  equipes: { id: string; nome: string }[];
  pessoas: { id: string; nome: string; cargo: string | null }[];
  inicial?: Inicial;
  hoje: string;
}) {
  const router = useRouter();
  const [passo, setPasso] = useState<1 | 2 | 3>(inicial ? 2 : 1);
  const [modelo, setModelo] = useState<ModeloCliente | null>(null);
  const [perguntas, setPerguntas] = useState<PerguntaDef[]>(inicial?.perguntas ?? []);
  const [cfg, setCfg] = useState<Config>(
    inicial ?? { titulo: "", descricao: "", anonima: true, audienciaTipo: "todos", areaIds: [], equipeIds: [], colaboradorIds: [], dataInicio: hoje, encerraEm: "", linkAberto: false },
  );
  const [novoTipo, setNovoTipo] = useState<TipoPergunta>("likert");
  const [filtroPessoa, setFiltroPessoa] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function escolher(m: ModeloCliente | null) {
    setModelo(m);
    setPerguntas(m ? m.perguntas.map((q) => ({ ...q, id: novoId() })) : []);
    if (m && !cfg.titulo) setCfg((c) => ({ ...c, titulo: m.nome, descricao: m.descricao ?? "" }));
    setPasso(2);
  }
  const alterar = (i: number, p: PerguntaDef) => setPerguntas((l) => l.map((x, k) => (k === i ? p : x)));
  const mover = (i: number, d: -1 | 1) =>
    setPerguntas((l) => {
      const n = [...l];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  const alternar = (campo: "areaIds" | "equipeIds" | "colaboradorIds", id: string) =>
    setCfg((c) => ({ ...c, [campo]: c[campo].includes(id) ? c[campo].filter((x) => x !== id) : [...c[campo], id] }));

  function validarPerguntas() {
    const r = perguntasSchema.safeParse(perguntas.map((p, i) => ({ ...p, order: i })));
    if (!r.success) {
      setErro(r.error.issues[0].message);
      return false;
    }
    setErro(null);
    return true;
  }

  function salvar(enviar: boolean) {
    if (!validarPerguntas()) {
      setPasso(2);
      return;
    }
    if (cfg.titulo.trim().length < 3) {
      setErro("Informe o título da pesquisa.");
      return;
    }
    const payload = { ...cfg, id: inicial?.id, modeloId: modelo?.id ?? null, modeloSlug: modelo?.slug ?? null, perguntas: perguntas.map((p, i) => ({ ...p, order: i })) };
    iniciar(async () => {
      const r = await salvarPesquisaWizard(JSON.stringify(payload), enviar);
      if (r.erro) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      if (r.envio) {
        const { enviados, falhas, semEmail } = r.envio;
        const extra = [falhas.length ? `${falhas.length} falha(s): ${falhas.slice(0, 3).map((f) => `${f.nome} (${f.motivo})`).join("; ")}` : "", semEmail ? `${semEmail} sem e-mail` : ""].filter(Boolean).join(" · ");
        (falhas.length ? toast.warning : toast.success)(`Pesquisa enviada: ${enviados} e-mail(s) enviados.${extra ? ` ${extra}` : ""}`);
      } else toast.success(r.ok ?? "Salvo.");
      router.push(`/pulse/${r.id}`);
    });
  }

  const Passos = (
    <ol className="flex flex-wrap gap-2 text-sm" aria-label="Etapas">
      {["Template", "Perguntas", "Configuração"].map((t, i) => (
        <li key={t}>
          <button
            type="button"
            disabled={(i === 0 && !!inicial) || (i === 2 && !perguntas.length)}
            aria-current={passo === i + 1 ? "step" : undefined}
            onClick={() => (i === 2 ? validarPerguntas() && setPasso(3) : setPasso((i + 1) as 1 | 2 | 3))}
            className={cn("inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 font-medium disabled:opacity-40", passo === i + 1 && "border-primary bg-primary text-primary-foreground")}
          >
            <span className="tabular-nums">{i + 1}</span> {t}
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="flex flex-col gap-4">
      {Passos}

      {passo === 1 && (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <li>
            <button type="button" onClick={() => escolher(null)} className="flex h-full w-full flex-col items-start gap-2 rounded-lg border border-dashed border-input bg-card p-5 text-left hover:border-primary">
              <FilePlus2 className="size-6 text-muted-foreground" aria-hidden />
              <span className="font-heading font-bold">Começar do zero</span>
              <span className="text-sm text-muted-foreground">Monte as perguntas com os 16 tipos disponíveis.</span>
            </button>
          </li>
          {modelos.map((m) => {
            const Icone = ICONES[m.icone ?? ""] ?? ClipboardList;
            return (
              <li key={m.id}>
                <button type="button" onClick={() => escolher(m)} className="flex h-full w-full flex-col items-start gap-2 rounded-lg border border-border bg-card p-5 text-left shadow-surface hover:border-primary hover:shadow-hover">
                  <span className="flex size-10 items-center justify-center rounded-md text-white" style={{ background: m.cor ?? "#0B1F3A" }} aria-hidden>
                    <Icone className="size-5" />
                  </span>
                  <span className="font-heading font-bold">
                    {m.nome} {m.daEmpresa && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">da empresa</span>}
                  </span>
                  <span className="text-sm text-muted-foreground">{m.descricao}</span>
                  <span className="text-xs text-muted-foreground">{m.perguntas.length} pergunta(s)</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {passo === 2 && (
        <>
          <ol className="flex flex-col gap-3">
            {perguntas.map((p, i) => (
              <EditorPergunta key={p.id} p={p} i={i} total={perguntas.length} alterar={(n) => alterar(i, n)} remover={() => setPerguntas((l) => l.filter((_, k) => k !== i))} mover={(d) => mover(i, d)} />
            ))}
          </ol>
          {!perguntas.length && <p className="rounded-lg border border-dashed border-input bg-card p-6 text-center text-sm text-muted-foreground">Nenhuma pergunta ainda. Escolha um tipo e adicione.</p>}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-4">
            <select aria-label="Tipo da nova pergunta" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as TipoPergunta)} className={cn(campo, "h-10 w-auto")}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {NOME_TIPO[t]}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={perguntas.length >= 40}
              onClick={() => setPerguntas((l) => [...l, { id: novoId(), type: novoTipo, text: "", required: novoTipo !== "long_text" && novoTipo !== "short_text", order: l.length, ...configPadrao(novoTipo) }])}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              <Plus className="size-4" aria-hidden /> Adicionar pergunta
            </button>
            <button type="button" disabled={!perguntas.length} onClick={() => validarPerguntas() && setPasso(3)} className="ml-auto h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-40">
              Continuar
            </button>
          </div>
        </>
      )}

      {passo === 3 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-surface">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
              Título
              <input value={cfg.titulo} maxLength={120} onChange={(e) => setCfg({ ...cfg, titulo: e.target.value })} className={cn(campo, "h-10 font-normal")} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
              Descrição (aparece no convite e na abertura)
              <textarea rows={3} maxLength={1000} value={cfg.descricao} onChange={(e) => setCfg({ ...cfg, descricao: e.target.value })} className={cn(campo, "py-2 font-normal")} />
            </label>
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 text-[13px] font-semibold">Anonimato</legend>
              <label className="flex items-start gap-2">
                <input type="radio" name="anonima" checked={cfg.anonima} onChange={() => setCfg({ ...cfg, anonima: true })} className="mt-1 accent-[var(--primary)]" />
                <span>
                  <strong>Anônima</strong> — respostas sem identificação; resultados agregados após o encerramento, com mínimo de respondentes.
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="anonima" checked={!cfg.anonima} onChange={() => setCfg({ ...cfg, anonima: false, linkAberto: false })} className="mt-1 accent-[var(--primary)]" />
                <span>
                  <strong>Identificada</strong> — respostas associadas à pessoa (ela é avisada antes de responder).
                </span>
              </label>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                Início
                <input type="date" min={hoje} value={cfg.dataInicio} onChange={(e) => setCfg({ ...cfg, dataInicio: e.target.value })} className={cn(campo, "h-10 font-normal")} />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                Fim
                <input type="date" min={cfg.dataInicio || hoje} value={cfg.encerraEm} onChange={(e) => setCfg({ ...cfg, encerraEm: e.target.value })} className={cn(campo, "h-10 font-normal")} />
              </label>
            </div>
            {cfg.anonima && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={cfg.linkAberto} onChange={(e) => setCfg({ ...cfg, linkAberto: e.target.checked })} className="mt-1 size-4 accent-[var(--primary)]" />
                <span>
                  <strong>Permitir link aberto</strong> — qualquer pessoa com o link responde sem link pessoal. A duplicidade passa a ser controlada só no navegador.
                </span>
              </label>
            )}
          </section>
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-surface">
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 text-[13px] font-semibold">Audiência</legend>
              {(
                [
                  ["todos", "Toda a organização"],
                  ["departamentos", "Departamentos"],
                  ["equipes", "Equipes"],
                  ["colaboradores", "Pessoas específicas"],
                ] as const
              ).map(([v, r]) => (
                <label key={v} className="flex items-center gap-2">
                  <input type="radio" name="audiencia" checked={cfg.audienciaTipo === v} onChange={() => setCfg({ ...cfg, audienciaTipo: v })} className="accent-[var(--primary)]" /> {r}
                </label>
              ))}
            </fieldset>
            {cfg.audienciaTipo === "departamentos" && (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {departamentos.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={cfg.areaIds.includes(d.id)} onChange={() => alternar("areaIds", d.id)} className="size-4 accent-[var(--primary)]" /> {d.nome}
                  </label>
                ))}
              </div>
            )}
            {cfg.audienciaTipo === "equipes" && (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {equipes.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={cfg.equipeIds.includes(d.id)} onChange={() => alternar("equipeIds", d.id)} className="size-4 accent-[var(--primary)]" /> {d.nome}
                  </label>
                ))}
              </div>
            )}
            {cfg.audienciaTipo === "colaboradores" && (
              <div className="flex flex-col gap-2">
                <input aria-label="Filtrar pessoas" placeholder="Filtrar por nome" value={filtroPessoa} onChange={(e) => setFiltroPessoa(e.target.value)} className={cn(campo, "h-9")} />
                <div className="grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {pessoas
                    .filter((p) => p.nome.toLowerCase().includes(filtroPessoa.toLowerCase()))
                    .map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={cfg.colaboradorIds.includes(p.id)} onChange={() => alternar("colaboradorIds", p.id)} className="size-4 accent-[var(--primary)]" /> {p.nome}
                      </label>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">{cfg.colaboradorIds.length} selecionada(s)</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Ao enviar, cada pessoa da audiência recebe por e-mail um link pessoal (sem login). A taxa de resposta usa o público no momento do envio.</p>
          </section>
          <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
            <button type="button" disabled={pendente} onClick={() => salvar(false)} className="h-11 rounded-lg border border-border bg-card px-5 text-sm font-medium hover:bg-muted disabled:opacity-50">
              Salvar rascunho
            </button>
            <button type="button" disabled={pendente} onClick={() => salvar(true)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />} Enviar agora
            </button>
          </div>
        </div>
      )}

      {erro && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}
