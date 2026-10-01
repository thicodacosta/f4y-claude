"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { responderEntrevistaPublica } from "@/lib/offboarding/responder-actions";
import { registrarEntrevistaConduzida } from "@/lib/offboarding/actions";
import { CHAVES_MOTIVO, MOTIVOS, type Motivo } from "@/lib/offboarding/motivos";
import { CHAVES_DIMENSAO, DESTINOS, DIMENSOES, ESCALA, SIM_TALVEZ_NAO, type Dimensao } from "@/lib/offboarding/questionario";
import { cn } from "@/lib/utils";

const campo = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Bloco({ n, titulo, ajuda, children }: { n: number; titulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-surface">
      <legend className="sr-only">{titulo}</legend>
      <div>
        <p className="font-heading font-bold" aria-hidden>
          <span className="mr-2 text-teal-strong">{n}.</span>
          {titulo}
        </p>
        {ajuda && <p className="mt-0.5 text-sm text-muted-foreground">{ajuda}</p>}
      </div>
      {children}
    </fieldset>
  );
}

function Escolha({ nome, valor, opcoes, onChange, rotulo }: { nome: string; valor: string; opcoes: Record<string, string>; onChange: (v: string) => void; rotulo: string }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
      {Object.entries(opcoes).map(([v, r]) => (
        <label key={v} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50", valor === v ? "border-teal bg-teal-soft font-medium text-teal-strong" : "border-border hover:bg-muted")}>
          <input type="radio" name={nome} value={v} checked={valor === v} onChange={() => onChange(v)} className="sr-only" />
          {r}
        </label>
      ))}
    </div>
  );
}

/**
 * Entrevista de desligamento. `modo="publico"` (link do e-mail, sem login) ou
 * `modo="interno"` (RH registra uma entrevista conduzida). Mesmo questionário,
 * validado de novo no servidor.
 */
export function FormularioEntrevista({ modo, token, desligamentoId, cor = "#0B1F3A" }: { modo: "publico" | "interno"; token?: string; desligamentoId?: string; cor?: string }) {
  const router = useRouter();
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [principal, setPrincipal] = useState<Motivo | "">("");
  const [decisao, setDecisao] = useState("");
  const [exp, setExp] = useState<Partial<Record<Dimensao, number>>>({});
  const [evitavel, setEvitavel] = useState("");
  const [oQue, setOQue] = useState("");
  const [enps, setEnps] = useState<number | null>(null);
  const [voltaria, setVoltaria] = useState("");
  const [destino, setDestino] = useState("");
  const [sugestoes, setSugestoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [pendente, iniciar] = useTransition();
  const voce = modo === "publico";

  if (enviado)
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-10 text-center shadow-surface">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <h2 className="font-heading text-2xl font-bold">Obrigado pela sinceridade</h2>
        <p className="max-w-md text-sm text-muted-foreground">Suas respostas foram registradas e serão usadas para melhorar a experiência de quem fica. Desejamos sucesso nos próximos passos.</p>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        const respostas = {
          motivos,
          motivoPrincipal: principal || undefined,
          decisao,
          experiencia: exp,
          evitavel: evitavel || undefined,
          oQueEvitaria: oQue,
          enps,
          voltaria: voltaria || undefined,
          destino: destino || null,
          sugestoes,
        };
        iniciar(async () => {
          const r = modo === "publico" ? await responderEntrevistaPublica(token!, JSON.stringify(respostas)) : await registrarEntrevistaConduzida(desligamentoId!, JSON.stringify(respostas));
          if (r.erro) {
            setErro(r.erro);
            toast.error(r.erro);
            return;
          }
          if (modo === "publico") setEnviado(true);
          else {
            toast.success("Entrevista registrada.");
            router.refresh();
          }
        });
      }}
    >
      <Bloco n={1} titulo={voce ? "O que levou você a sair?" : "O que levou a pessoa a sair?"} ajuda="Marque até 5 motivos e indique o principal.">
        <div className="grid gap-2 sm:grid-cols-2">
          {CHAVES_MOTIVO.filter((m) => m !== "desempenho" && m !== "reestruturacao").map((m) => {
            const marcado = motivos.includes(m);
            return (
              <label key={m} className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50", marcado ? "border-teal bg-teal-soft" : "border-border hover:bg-muted")}>
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => {
                    setMotivos((x) => (marcado ? x.filter((y) => y !== m) : x.length >= 5 ? x : [...x, m]));
                    if (marcado && principal === m) setPrincipal("");
                  }}
                  className="mt-0.5 size-4 accent-[var(--teal)]"
                />
                <span>
                  <span className="block font-medium">{MOTIVOS[m].nome}</span>
                  <span className="block text-xs text-muted-foreground">{MOTIVOS[m].resumo}</span>
                </span>
              </label>
            );
          })}
        </div>
        {motivos.length > 0 && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Principal motivo
            <select value={principal} onChange={(e) => setPrincipal(e.target.value as Motivo)} required className={cn(campo, "h-10 font-normal")}>
              <option value="">Escolha…</option>
              {motivos.map((m) => (
                <option key={m} value={m}>
                  {MOTIVOS[m].nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {voce ? "O que mais pesou na sua decisão?" : "O que mais pesou na decisão?"} <span className="font-normal text-muted-foreground">(opcional)</span>
          <textarea value={decisao} onChange={(e) => setDecisao(e.target.value)} rows={3} maxLength={3000} className={campo} />
        </label>
      </Bloco>

      <Bloco n={2} titulo={voce ? "Como foi sua experiência na empresa?" : "Como foi a experiência na empresa?"} ajuda="De 1 (muito insatisfeito) a 5 (muito satisfeito).">
        <ul className="flex flex-col divide-y divide-border">
          {CHAVES_DIMENSAO.map((d) => (
            <li key={d} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span id={`dim-${d}`} className="text-sm">
                {DIMENSOES[d]}
              </span>
              <span role="radiogroup" aria-labelledby={`dim-${d}`} className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <label key={v} title={ESCALA[v - 1]} className={cn("flex size-9 cursor-pointer items-center justify-center rounded-md border text-sm font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/50", exp[d] === v ? "border-teal bg-teal text-white" : "border-border hover:bg-muted")}>
                    <input type="radio" name={`exp-${d}`} value={v} checked={exp[d] === v} onChange={() => setExp((x) => ({ ...x, [d]: v }))} className="sr-only" aria-label={`${v} — ${ESCALA[v - 1]}`} />
                    {v}
                  </label>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco n={3} titulo="Algo poderia ter evitado a saída?">
        <Escolha nome="evitavel" rotulo="Algo poderia ter evitado a saída?" valor={evitavel} opcoes={SIM_TALVEZ_NAO} onChange={setEvitavel} />
        {(evitavel === "sim" || evitavel === "talvez") && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            O quê?
            <textarea value={oQue} onChange={(e) => setOQue(e.target.value)} rows={3} maxLength={2000} className={campo} />
          </label>
        )}
      </Bloco>

      <Bloco n={4} titulo={voce ? "De 0 a 10, quanto você recomendaria a empresa como lugar para trabalhar?" : "De 0 a 10, quanto recomendaria a empresa como lugar para trabalhar?"}>
        <div role="radiogroup" aria-label="Nota de recomendação de 0 a 10" className="flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, v) => (
            <label key={v} className={cn("flex size-10 cursor-pointer items-center justify-center rounded-md border text-sm font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/50", enps === v ? "text-white" : "border-border hover:bg-muted")} style={enps === v ? { background: cor, borderColor: cor } : undefined}>
              <input type="radio" name="enps" value={v} checked={enps === v} onChange={() => setEnps(v)} className="sr-only" aria-label={String(v)} />
              {v}
            </label>
          ))}
        </div>
        <p className="flex justify-between text-xs text-muted-foreground">
          <span>0 · Nada provável</span>
          <span>10 · Muito provável</span>
        </p>
      </Bloco>

      <Bloco n={5} titulo={voce ? "Você voltaria a trabalhar conosco?" : "Voltaria a trabalhar na empresa?"}>
        <Escolha nome="voltaria" rotulo="Voltaria a trabalhar na empresa?" valor={voltaria} opcoes={SIM_TALVEZ_NAO} onChange={setVoltaria} />
      </Bloco>

      <Bloco n={6} titulo={voce ? "Qual é o seu próximo passo?" : "Próximo passo da pessoa"} ajuda="Opcional.">
        <select value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Próximo passo" className={cn(campo, "h-10")}>
          <option value="">Prefiro não responder</option>
          {Object.entries(DESTINOS).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </Bloco>

      <Bloco n={7} titulo="Sugestões para a empresa" ajuda="Opcional. O que deveríamos manter, mudar ou começar a fazer?">
        <textarea value={sugestoes} onChange={(e) => setSugestoes(e.target.value)} rows={4} maxLength={3000} aria-label="Sugestões para a empresa" className={campo} />
      </Bloco>

      {erro && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      <button type="submit" disabled={pendente} className="inline-flex h-11 w-fit items-center gap-2 rounded-lg px-6 text-sm font-semibold text-white disabled:opacity-60" style={{ background: cor }}>
        {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />} {voce ? "Enviar respostas" : "Registrar entrevista"}
      </button>
    </form>
  );
}
