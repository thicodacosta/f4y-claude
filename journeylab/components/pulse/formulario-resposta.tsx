"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { responderPesquisaPublica } from "@/lib/pulse/responder-actions";
import type { PerguntaDef, ValorResposta } from "@/lib/pulse/perguntas";
import { CampoPergunta, respondida } from "./campo-pergunta";
import { cn } from "@/lib/utils";

type Pergunta = PerguntaDef & { dbId: string };

function ler<T>(armazenamento: () => Storage, chave: string, padrao: T): T {
  try {
    const v = armazenamento().getItem(chave);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}
function gravar(armazenamento: () => Storage, chave: string, valor: unknown) {
  try {
    armazenamento().setItem(chave, JSON.stringify(valor));
  } catch {
    /* armazenamento indisponível: segue sem rascunho */
  }
}

export function FormularioResposta({
  pesquisaId,
  token,
  titulo,
  descricao,
  anonima,
  nome,
  perguntas,
  cor,
}: {
  pesquisaId: string;
  token: string | null;
  titulo: string;
  descricao: string | null;
  anonima: boolean;
  nome: string | null;
  perguntas: Pergunta[];
  cor: string;
}) {
  const chaveRascunho = `pulse_rascunho_${pesquisaId}`;
  const chaveRespondida = `survey_answered_${pesquisaId}`;
  const [etapa, setEtapa] = useState<"inicio" | "perguntas" | "fim" | "ja">("inicio");
  const [respostas, setRespostas] = useState<Record<string, ValorResposta>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [faltando, setFaltando] = useState<Set<string>>(new Set());
  const [pendente, iniciar] = useTransition();

  // Restaura rascunho e o aviso de "já respondeu neste navegador" (somente leitura inicial).
  useEffect(() => {
    const ja = ler(() => localStorage, chaveRespondida, false);
    const rascunho = ler<Record<string, ValorResposta>>(() => sessionStorage, chaveRascunho, {});
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização única com o armazenamento do navegador
    if (ja) setEtapa("ja");
    else if (Object.keys(rascunho).length) setRespostas(rascunho);
  }, [chaveRascunho, chaveRespondida]);

  const alterar = (id: string, v: ValorResposta | undefined) =>
    setRespostas((r) => {
      const novo = { ...r };
      if (v === undefined) delete novo[id];
      else novo[id] = v;
      gravar(() => sessionStorage, chaveRascunho, novo);
      return novo;
    });

  const total = perguntas.length;
  const feitas = perguntas.filter((p) => respondida(p, respostas[p.dbId])).length;

  function enviar() {
    const obrigatoriasVazias = perguntas.filter((p) => p.required && !respondida(p, respostas[p.dbId]));
    if (obrigatoriasVazias.length) {
      setFaltando(new Set(obrigatoriasVazias.map((p) => p.dbId)));
      setErro(`Responda as perguntas obrigatórias (${obrigatoriasVazias.length} pendente${obrigatoriasVazias.length > 1 ? "s" : ""}).`);
      document.getElementById(`q-${obrigatoriasVazias[0].dbId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await responderPesquisaPublica(pesquisaId, token, JSON.stringify(respostas));
      if (r.erro) {
        setErro(r.erro);
        if (/já respondeu|já enviou/.test(r.erro)) gravar(() => localStorage, chaveRespondida, true);
        return;
      }
      gravar(() => localStorage, chaveRespondida, true);
      try {
        sessionStorage.removeItem(chaveRascunho);
      } catch {}
      setEtapa("fim");
      window.scrollTo({ top: 0 });
    });
  }

  if (etapa === "fim" || etapa === "ja")
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-10 text-center shadow-surface">
        <CheckCircle2 className="size-12 text-success" aria-hidden />
        <h2 className="font-heading text-2xl font-bold">{etapa === "fim" ? "Obrigado pela sua resposta!" : "Você já respondeu esta pesquisa"}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {anonima ? "Suas respostas foram registradas de forma anônima e só aparecem nos resultados agregados." : "Suas respostas foram registradas."} Você já pode fechar esta página.
        </p>
      </div>
    );

  if (etapa === "inicio")
    return (
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6 shadow-surface sm:p-8">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">{titulo}</h1>
          {descricao && <p className="mt-2 leading-relaxed whitespace-pre-line text-muted-foreground">{descricao}</p>}
        </div>
        {anonima ? (
          <p className="flex items-start gap-2 rounded-lg border border-teal/30 bg-teal-soft px-4 py-3 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-strong" aria-hidden />
            <span>
              <strong>Suas respostas são 100% anônimas.</strong> Não guardamos seu nome, e-mail, IP nem o horário junto das respostas, e os resultados só aparecem agregados. Registramos apenas que você participou, para
              não pedir de novo.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong>Esta pesquisa é identificada.</strong> Suas respostas ficarão associadas ao seu nome{nome ? ` (${nome})` : ""}.
            </span>
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {total} pergunta{total > 1 ? "s" : ""} · cerca de {Math.max(1, Math.ceil(total / 3))} minuto{total > 3 ? "s" : ""}.
        </p>
        <div>
          <button type="button" onClick={() => setEtapa("perguntas")} className="h-11 rounded-lg px-6 text-sm font-semibold text-white" style={{ background: cor }}>
            Começar
          </button>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{titulo}</span>
          <span className="tabular-nums">
            {feitas}/{total} respondidas
          </span>
        </div>
        <div role="progressbar" aria-valuenow={feitas} aria-valuemin={0} aria-valuemax={total} aria-label="Progresso" className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-[width]" style={{ width: `${total ? (feitas / total) * 100 : 0}%`, background: cor }} />
        </div>
      </div>
      {perguntas.map((p, i) => (
        <section key={p.dbId} id={`q-${p.dbId}`} aria-labelledby={`t-${p.dbId}`} className={cn("rounded-lg border bg-card p-5 shadow-surface", faltando.has(p.dbId) && !respondida(p, respostas[p.dbId]) ? "border-destructive" : "border-border")}>
          <h2 id={`t-${p.dbId}`} className="mb-3 text-[15px] font-semibold">
            {i + 1}. {p.text}
            {p.required ? (
              <span className="ml-1 text-destructive" aria-label="obrigatória">
                *
              </span>
            ) : (
              <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>
            )}
          </h2>
          <CampoPergunta p={p} nome={`q_${p.dbId}`} valor={respostas[p.dbId]} onChange={(v) => alterar(p.dbId, v)} />
        </section>
      ))}
      {erro && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      <div>
        <button type="button" onClick={enviar} disabled={pendente} className="inline-flex h-11 items-center gap-2 rounded-lg px-6 text-sm font-semibold text-white disabled:opacity-60" style={{ background: cor }}>
          {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Enviar respostas
        </button>
      </div>
    </div>
  );
}
