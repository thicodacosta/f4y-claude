"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { candidatar } from "@/lib/carreiras/candidatura-actions";
import { TAMANHO_CURRICULO } from "@/lib/carreiras/regras";
import { cn } from "@/lib/utils";

const campo = "w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

/** Validação no navegador (o servidor repete todas as regras e confere a assinatura do arquivo). */
function validar(fd: FormData) {
  const e: Record<string, string> = {};
  const nome = String(fd.get("nome") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim();
  const tel = String(fd.get("telefone") ?? "").replace(/\D/g, "");
  const arq = fd.get("curriculo");
  if (nome.length < 2) e.nome = "Informe seu nome completo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Informe um e-mail válido.";
  if (tel.length < 10 || tel.length > 13) e.telefone = "Informe um telefone com DDD.";
  if (!(arq instanceof File) || arq.size === 0) e.curriculo = "Anexe seu currículo.";
  else if (!/\.(pdf|docx)$/i.test(arq.name)) e.curriculo = "Envie PDF ou DOCX.";
  else if (arq.size > TAMANHO_CURRICULO) e.curriculo = "Máximo de 10 MB.";
  return e;
}

export function FormCandidatura({ orgSlug, vagaSlug, titulo, org, cor }: { orgSlug: string; vagaSlug: string; titulo: string; org: string; cor: string }) {
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [pendente, iniciar] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  if (enviado)
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center shadow-surface">
        <CheckCircle2 className="size-12 text-success" aria-hidden />
        <h2 className="font-heading text-xl font-bold">Candidatura enviada</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Recebemos sua candidatura para <strong className="text-foreground">{titulo}</strong>. A equipe de {org} analisará seu currículo e entrará em contato pelo e-mail ou telefone informados.
        </p>
      </div>
    );

  return (
    <form
      ref={ref}
      noValidate
      aria-labelledby="form-candidatura"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-surface sm:p-6"
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        const e = validar(fd);
        setErros(e);
        setErro(null);
        if (Object.keys(e).length) {
          ref.current?.querySelector<HTMLElement>(`[name="${Object.keys(e)[0]}"]`)?.focus();
          return;
        }
        iniciar(async () => {
          const r = await candidatar(orgSlug, vagaSlug, fd);
          if (r.erro) {
            setErro(r.erro);
            if (r.campos) setErros(r.campos);
            return;
          }
          setEnviado(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }}
    >
      <h2 id="form-candidatura" className="font-heading text-xl font-bold">
        Candidatar-se
      </h2>
      <p className="-mt-2 text-sm text-muted-foreground">Sem cadastro: basta enviar seus dados de contato e o currículo.</p>
      {(
        [
          ["nome", "Nome completo", "text", "name"],
          ["email", "E-mail", "email", "email"],
          ["telefone", "Telefone com DDD", "tel", "tel"],
        ] as const
      ).map(([nome, rotulo, tipo, auto]) => (
        <label key={nome} className="flex flex-col gap-1.5 text-sm font-semibold">
          {rotulo}
          <input name={nome} type={tipo} autoComplete={auto} required maxLength={nome === "telefone" ? 30 : 200} aria-invalid={!!erros[nome]} aria-describedby={erros[nome] ? `erro-${nome}` : undefined} className={cn(campo, "h-11 font-normal")} />
          {erros[nome] && (
            <span id={`erro-${nome}`} className="text-xs font-normal text-destructive">
              {erros[nome]}
            </span>
          )}
        </label>
      ))}
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Currículo (PDF ou DOCX, até 10 MB)
        <input
          name="curriculo"
          type="file"
          required
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          aria-invalid={!!erros.curriculo}
          aria-describedby={erros.curriculo ? "erro-curriculo" : undefined}
          className="text-sm font-normal file:mr-3 file:h-10 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:text-sm file:font-medium"
        />
        {erros.curriculo && (
          <span id="erro-curriculo" className="text-xs font-normal text-destructive">
            {erros.curriculo}
          </span>
        )}
      </label>
      {/* Campo-armadilha contra envios automatizados (oculto para pessoas e leitores de tela). */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site
          <input name="site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Ao enviar, seus dados e seu currículo serão tratados por {org} para este processo seletivo, no JourneyLab, conforme a{" "}
          <Link href="/privacidade" target="_blank" className="font-medium underline">
            Política de Privacidade
          </Link>
          . O currículo fica em área privada, acessível somente à equipe autorizada da empresa.
        </span>
      </p>
      {erro && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      <div>
        <button type="submit" disabled={pendente} className="inline-flex h-11 items-center gap-2 rounded-lg px-6 text-sm font-semibold text-white disabled:opacity-60" style={{ background: cor }}>
          {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />} Enviar candidatura
        </button>
      </div>
    </form>
  );
}
