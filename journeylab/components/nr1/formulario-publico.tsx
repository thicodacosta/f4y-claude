"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { responderNr1Publico } from "@/lib/nr1/responder-actions";
import { ESCALA_NR1, SEM_RESPOSTA } from "@/lib/nr1/questionario";
import { cn } from "@/lib/utils";

type Secao = { id: string; nome: string; descricao: string | null; perguntas: { id: string; texto: string }[] };
type Valor = number | null; // null = prefiro não responder
const NAO = "nao";

export function FormularioNr1({
  token,
  titulo,
  descricao,
  prazo,
  privacidade,
  secoes,
  areas,
  cor,
}: {
  token: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  privacidade: string;
  secoes: Secao[];
  areas: { id: string; nome: string }[];
  cor: string;
}) {
  const chave = `nr1_rascunho_${token.slice(0, 36)}`;
  const [etapa, setEtapa] = useState<"inicio" | "secoes" | number | "revisao" | "fim">("inicio");
  const [respostas, setRespostas] = useState<Record<string, Valor>>({});
  const [area, setArea] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const total = secoes.reduce((n, s) => n + s.perguntas.length, 0);
  const feitas = Object.keys(respostas).length;

  // Rascunho temporário só neste dispositivo (sessionStorage), restaurado uma vez ao abrir.
  useEffect(() => {
    try {
      const r = sessionStorage.getItem(chave);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronização única com o armazenamento do navegador
      if (r) setRespostas(JSON.parse(r));
    } catch {}
  }, [chave]);

  const responder = (id: string, v: Valor) =>
    setRespostas((x) => {
      const n = { ...x, [id]: v };
      try {
        sessionStorage.setItem(chave, JSON.stringify(n));
      } catch {}
      return n;
    });

  const ir = (e: typeof etapa) => {
    setErro(null);
    setEtapa(e);
    window.scrollTo({ top: 0 });
  };

  function avancarSecao(i: number) {
    const faltam = secoes[i].perguntas.filter((p) => !(p.id in respostas));
    if (faltam.length) {
      setErro(`Responda as ${faltam.length} pergunta(s) restante(s) desta seção — ou escolha “${SEM_RESPOSTA.toLowerCase()}”.`);
      document.getElementById(`p-${faltam[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    ir(i + 1 < secoes.length ? i + 1 : "revisao");
  }

  function enviar() {
    if (feitas < total) {
      setErro("Há perguntas sem resposta. Volte às seções indicadas.");
      return;
    }
    iniciar(async () => {
      const r = await responderNr1Publico(token, area || null, JSON.stringify(respostas));
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      try {
        sessionStorage.removeItem(chave);
      } catch {}
      setRespostas({});
      ir("fim");
    });
  }

  const botao = "inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white disabled:opacity-60";
  const secundario = "h-11 rounded-lg border border-border bg-card px-5 text-sm font-medium hover:bg-muted";

  if (etapa === "fim")
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-10 text-center shadow-surface">
        <CheckCircle2 className="size-12 text-success" aria-hidden />
        <h1 className="font-heading text-2xl font-bold">Resposta registrada. Obrigado!</h1>
        <p className="max-w-md text-sm text-muted-foreground">Seu link foi usado e não aceita um novo envio. O rascunho temporário foi apagado deste dispositivo. Você já pode fechar esta página.</p>
      </div>
    );

  if (etapa === "inicio")
    return (
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6 shadow-surface sm:p-8">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">{titulo}</h1>
          {descricao && <p className="mt-2 leading-relaxed whitespace-pre-line text-muted-foreground">{descricao}</p>}
        </div>
        <p className="text-sm">
          Pesquisa sobre as <strong>condições e a organização do trabalho</strong>. Não é uma avaliação de saúde nem de desempenho. São {total} perguntas de frequência
          {prazo ? `; prazo até ${prazo}` : ""}.
        </p>
        <div className="flex items-start gap-2 rounded-lg border border-teal/30 bg-teal-soft px-4 py-3 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-strong" aria-hidden />
          <div className="flex flex-col gap-1.5">
            <p>
              <strong>Como tratamos suas respostas.</strong> {privacidade}
            </p>
            <p className="text-muted-foreground">
              Enquanto você responde, um rascunho fica guardado temporariamente apenas neste navegador (até fechar a aba) e é apagado após o envio.
            </p>
          </div>
        </div>
        <div>
          <button type="button" onClick={() => ir("secoes")} className={botao} style={{ background: cor }}>
            Começar
          </button>
        </div>
      </div>
    );

  if (etapa === "secoes")
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-surface">
        <h1 className="font-heading text-xl font-bold">Seções da pesquisa</h1>
        <p className="text-sm text-muted-foreground">
          Para cada frase, indique com que frequência ela acontece no seu trabalho: {ESCALA_NR1.map((e) => e.rotulo.toLowerCase()).join(", ")}. Se preferir não responder alguma, há essa opção.
        </p>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
          {secoes.map((s) => (
            <li key={s.id}>
              {s.nome} <span className="text-muted-foreground">({s.perguntas.length})</span>
            </li>
          ))}
        </ol>
        <div className="flex gap-2">
          <button type="button" onClick={() => ir("inicio")} className={secundario}>
            Voltar
          </button>
          <button type="button" onClick={() => ir(0)} className={botao} style={{ background: cor }}>
            Responder
          </button>
        </div>
      </div>
    );

  const Progresso = (
    <div className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{typeof etapa === "number" ? `Seção ${etapa + 1} de ${secoes.length}` : "Revisão"}</span>
        <span className="tabular-nums">
          {feitas}/{total} respondidas
        </span>
      </div>
      <div role="progressbar" aria-label="Progresso" aria-valuenow={feitas} aria-valuemin={0} aria-valuemax={total} className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${total ? (feitas / total) * 100 : 0}%`, background: cor }} />
      </div>
    </div>
  );

  if (etapa === "revisao") {
    const pendentes = secoes.map((s, i) => ({ s, i, faltam: s.perguntas.filter((p) => !(p.id in respostas)).length, nao: s.perguntas.filter((p) => respostas[p.id] === null).length }));
    return (
      <div className="flex flex-col gap-4">
        {Progresso}
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-surface">
          <h1 className="font-heading text-xl font-bold">Revisão</h1>
          <ul className="flex flex-col gap-1 text-sm">
            {pendentes.map(({ s, i, faltam, nao }) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{s.nome}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {faltam ? <strong className="text-destructive">{faltam} sem resposta</strong> : "Completa"}
                  {nao > 0 && ` · ${nao} “prefiro não responder”`}
                  <button type="button" onClick={() => ir(i)} className="font-medium text-teal-strong hover:underline">
                    Revisar
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {areas.length > 0 && (
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Departamento (opcional)
              <select value={area} onChange={(e) => setArea(e.target.value)} className="h-11 rounded-lg border border-input bg-background px-3 font-normal">
                <option value="">Prefiro não informar</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal text-muted-foreground">Usado só para resultados por departamento, exibidos apenas quando o grupo tem respostas suficientes.</span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => ir(secoes.length - 1)} className={secundario}>
              Voltar
            </button>
            <button type="button" onClick={enviar} disabled={pendente} className={botao} style={{ background: cor }}>
              {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />} Enviar respostas
            </button>
          </div>
        </section>
        {erro && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        )}
      </div>
    );
  }

  const s = secoes[etapa];
  return (
    <div className="flex flex-col gap-4">
      {Progresso}
      <section aria-labelledby="secao" className="flex flex-col gap-4">
        <div>
          <h1 id="secao" className="font-heading text-xl font-bold">
            {s.nome}
          </h1>
          {s.descricao && <p className="text-sm text-muted-foreground">{s.descricao}</p>}
        </div>
        {s.perguntas.map((p, k) => {
          const v = respostas[p.id];
          const marcado = (x: Valor) => p.id in respostas && v === x;
          return (
            <fieldset key={p.id} id={`p-${p.id}`} className={cn("rounded-lg border bg-card p-5 shadow-surface", erro && !(p.id in respostas) ? "border-destructive" : "border-border")}>
              <legend className="sr-only">{p.texto}</legend>
              <p className="mb-3 text-[15px] font-semibold" aria-hidden>
                {k + 1}. {p.texto}
              </p>
              <div className="grid gap-2 sm:grid-cols-5">
                {ESCALA_NR1.map((e) => (
                  <label key={e.valor} className={cn("flex h-11 cursor-pointer items-center justify-center rounded-md border border-border px-2 text-center text-sm font-medium hover:bg-muted has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50", marcado(e.valor) && "border-transparent text-white")} style={marcado(e.valor) ? { background: cor } : undefined}>
                    <input type="radio" name={`q_${p.id}`} value={e.valor} checked={marcado(e.valor)} onChange={() => responder(p.id, e.valor)} className="sr-only" />
                    {e.rotulo}
                  </label>
                ))}
              </div>
              <label className={cn("mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50", marcado(null) && "font-semibold text-foreground")}>
                <input type="radio" name={`q_${p.id}`} value={NAO} checked={marcado(null)} onChange={() => responder(p.id, null)} className="accent-[var(--primary)]" />
                {SEM_RESPOSTA}
              </label>
            </fieldset>
          );
        })}
        {erro && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => ir(etapa === 0 ? "secoes" : etapa - 1)} className={secundario}>
            Voltar
          </button>
          <button type="button" onClick={() => avancarSecao(etapa)} className={botao} style={{ background: cor }}>
            {etapa + 1 < secoes.length ? "Próxima seção" : "Revisar"}
          </button>
        </div>
      </section>
    </div>
  );
}
