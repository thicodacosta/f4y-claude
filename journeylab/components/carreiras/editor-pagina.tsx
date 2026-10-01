"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { enviarImagemCarreiras, salvarPaginaCarreiras } from "@/lib/carreiras/pagina-actions";
import { TAMANHO_IMAGEM, type ConteudoPagina, type ImagemRef } from "@/lib/carreiras/pagina";
import { cn } from "@/lib/utils";

const campo = "w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const rotulo = "flex flex-col gap-1.5 text-[13px] font-semibold";

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-surface">
      <div>
        <h3 className="font-heading text-base font-bold">{titulo}</h3>
        {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

/** Seleção/envio de imagem com prévia e texto alternativo (acessibilidade). */
function CampoImagem({ rotuloCampo, valor, onChange, base, redonda }: { rotuloCampo: string; valor: ImagemRef | null; onChange: (v: ImagemRef | null) => void; base: string; redonda?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold">{rotuloCampo}</span>
      <div className="flex flex-wrap items-start gap-3">
        <div className={cn("flex size-24 shrink-0 items-center justify-center overflow-hidden border border-dashed border-input bg-muted/40", redonda ? "rounded-full" : "rounded-lg")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {valor ? <img src={`${base}/midia/${valor.id}`} alt={valor.alt || ""} className="size-full object-cover" /> : <ImagePlus className="size-6 text-muted-foreground" aria-hidden />}
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <input
            ref={ref}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={`Enviar ${rotuloCampo.toLowerCase()}`}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > TAMANHO_IMAGEM) return void toast.error("A imagem deve ter no máximo 5 MB.");
              const fd = new FormData();
              fd.set("imagem", f);
              iniciar(async () => {
                const r = await enviarImagemCarreiras(fd);
                if (r.erro || !r.id) return void toast.error(r.erro ?? "Falha no envio.");
                onChange({ id: r.id, alt: valor?.alt ?? "" });
                toast.success("Imagem enviada. Salve a página para publicar a alteração.");
              });
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pendente} onClick={() => ref.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:opacity-50">
              {pendente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />} {valor ? "Trocar imagem" : "Enviar imagem"}
            </button>
            {valor && (
              <button type="button" onClick={() => onChange(null)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" aria-hidden /> Remover
              </button>
            )}
          </div>
          {valor && (
            <input aria-label={`Descrição da imagem (${rotuloCampo})`} value={valor.alt} maxLength={160} onChange={(e) => onChange({ ...valor, alt: e.target.value })} placeholder="Descrição da imagem (acessibilidade)" className={cn(campo, "h-9")} />
          )}
          <span className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 5 MB.</span>
        </div>
      </div>
    </div>
  );
}

function Lado({ valor, onChange }: { valor: "esquerda" | "direita"; onChange: (v: "esquerda" | "direita") => void }) {
  return (
    <label className={rotulo}>
      Posição da imagem
      <select value={valor} onChange={(e) => onChange(e.target.value as "esquerda")} className={cn(campo, "h-10 w-48 font-normal")}>
        <option value="direita">À direita do texto</option>
        <option value="esquerda">À esquerda do texto</option>
      </select>
    </label>
  );
}

function mover<T>(lista: T[], i: number, d: -1 | 1) {
  const n = [...lista];
  [n[i], n[i + d]] = [n[i + d], n[i]];
  return n;
}

export function EditorPaginaCarreiras({ inicial, base, vagas }: { inicial: ConteudoPagina; base: string; vagas: { slug: string; titulo: string }[] }) {
  const [c, setC] = useState<ConteudoPagina>(inicial);
  const [textoBeneficios, setTextoBeneficios] = useState(inicial.beneficios.itens.join("\n"));
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const set = <K extends keyof ConteudoPagina>(k: K, v: ConteudoPagina[K]) => setC((x) => ({ ...x, [k]: v }));

  const salvar = () =>
    iniciar(async () => {
      setErro(null);
      const r = await salvarPaginaCarreiras(JSON.stringify(c));
      if (r.erro) {
        setErro(r.erro);
        toast.error(r.erro);
      } else toast.success(r.ok ?? "Salvo.");
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-surface">
        <p className="text-sm text-muted-foreground">Seções sem conteúdo não aparecem na página. As vagas publicadas entram automaticamente.</p>
        <div className="flex gap-2">
          <a href={base} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
            <ExternalLink className="size-4" aria-hidden /> Ver página
          </a>
          <button type="button" onClick={salvar} disabled={pendente} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar página
          </button>
        </div>
      </div>

      <Secao titulo="Capa" descricao="Imagem de destaque no topo, com título e chamada.">
        <CampoImagem rotuloCampo="Imagem de capa" base={base} valor={c.capa.imagem} onChange={(v) => set("capa", { ...c.capa, imagem: v })} />
        <label className={rotulo}>
          Título
          <input value={c.capa.titulo} maxLength={120} onChange={(e) => set("capa", { ...c.capa, titulo: e.target.value })} className={cn(campo, "h-10 font-normal")} placeholder="Ex.: Tecnologia que transforma o comércio global" />
        </label>
        <label className={rotulo}>
          Chamada
          <input value={c.capa.subtitulo} maxLength={300} onChange={(e) => set("capa", { ...c.capa, subtitulo: e.target.value })} className={cn(campo, "h-10 font-normal")} placeholder="Ex.: Faça parte do nosso time" />
        </label>
      </Secao>

      <Secao titulo="Sobre a empresa" descricao="Quem somos, propósito e cultura — texto e imagem lado a lado.">
        <label className={rotulo}>
          Título
          <input value={c.sobre.titulo} maxLength={120} onChange={(e) => set("sobre", { ...c.sobre, titulo: e.target.value })} className={cn(campo, "h-10 font-normal")} />
        </label>
        <label className={rotulo}>
          Texto
          <textarea rows={6} maxLength={4000} value={c.sobre.texto} onChange={(e) => set("sobre", { ...c.sobre, texto: e.target.value })} className={cn(campo, "py-2 font-normal")} />
        </label>
        <CampoImagem rotuloCampo="Imagem" base={base} valor={c.sobre.imagem} onChange={(v) => set("sobre", { ...c.sobre, imagem: v })} />
        <Lado valor={c.sobre.lado} onChange={(v) => set("sobre", { ...c.sobre, lado: v })} />
      </Secao>

      <Secao titulo="Blocos de texto e imagem" descricao="Até 6 blocos: cultura, ambiente, programas, diversidade…">
        {c.blocos.map((b, i) => (
          <fieldset key={i} className="flex flex-col gap-3 rounded-md border border-border p-4">
            <legend className="px-1 text-sm font-semibold">Bloco {i + 1}</legend>
            <div className="flex gap-1 self-end">
              <button type="button" aria-label="Mover bloco para cima" disabled={i === 0} onClick={() => set("blocos", mover(c.blocos, i, -1))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30">
                <ArrowUp className="size-4" />
              </button>
              <button type="button" aria-label="Mover bloco para baixo" disabled={i === c.blocos.length - 1} onClick={() => set("blocos", mover(c.blocos, i, 1))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30">
                <ArrowDown className="size-4" />
              </button>
              <button type="button" aria-label={`Remover bloco ${i + 1}`} onClick={() => set("blocos", c.blocos.filter((_, k) => k !== i))} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
            <label className={rotulo}>
              Título
              <input value={b.titulo} maxLength={120} onChange={(e) => set("blocos", c.blocos.map((x, k) => (k === i ? { ...x, titulo: e.target.value } : x)))} className={cn(campo, "h-10 font-normal")} />
            </label>
            <label className={rotulo}>
              Texto
              <textarea rows={4} maxLength={3000} value={b.texto} onChange={(e) => set("blocos", c.blocos.map((x, k) => (k === i ? { ...x, texto: e.target.value } : x)))} className={cn(campo, "py-2 font-normal")} />
            </label>
            <CampoImagem rotuloCampo="Imagem do bloco" base={base} valor={b.imagem} onChange={(v) => set("blocos", c.blocos.map((x, k) => (k === i ? { ...x, imagem: v } : x)))} />
            <Lado valor={b.lado} onChange={(v) => set("blocos", c.blocos.map((x, k) => (k === i ? { ...x, lado: v } : x)))} />
          </fieldset>
        ))}
        {c.blocos.length < 6 && (
          <button
            type="button"
            onClick={() => set("blocos", [...c.blocos, { titulo: "", texto: "", imagem: null, lado: c.blocos.length % 2 ? "direita" : "esquerda" }])}
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            <Plus className="size-4" aria-hidden /> Adicionar bloco
          </button>
        )}
      </Secao>

      <Secao titulo="Benefícios" descricao="Um benefício por linha.">
        <label className={rotulo}>
          Título da seção
          <input value={c.beneficios.titulo} maxLength={120} placeholder="Nossos benefícios" onChange={(e) => set("beneficios", { ...c.beneficios, titulo: e.target.value })} className={cn(campo, "h-10 font-normal")} />
        </label>
        <label className={rotulo}>
          Benefícios
          <textarea
            rows={6}
            value={textoBeneficios}
            onChange={(e) => {
              setTextoBeneficios(e.target.value);
              set("beneficios", { ...c.beneficios, itens: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 40) });
            }}
            className={cn(campo, "py-2 font-normal")}
            placeholder={"Plano de saúde\nVale-refeição\nDay-off de aniversário"}
          />
        </label>
      </Secao>

      <Secao titulo="Depoimentos" descricao="Até 8 depoimentos de pessoas do time, com foto opcional. Publique apenas com autorização de quem deu o depoimento.">
        {c.depoimentos.map((d, i) => (
          <fieldset key={i} className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold">Depoimento {i + 1}</legend>
            <label className={rotulo}>
              Nome
              <input value={d.nome} maxLength={80} onChange={(e) => set("depoimentos", c.depoimentos.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))} className={cn(campo, "h-10 font-normal")} />
            </label>
            <label className={rotulo}>
              Cargo
              <input value={d.cargo} maxLength={80} onChange={(e) => set("depoimentos", c.depoimentos.map((x, k) => (k === i ? { ...x, cargo: e.target.value } : x)))} className={cn(campo, "h-10 font-normal")} />
            </label>
            <label className={cn(rotulo, "sm:col-span-2")}>
              Depoimento
              <textarea rows={3} maxLength={1200} value={d.texto} onChange={(e) => set("depoimentos", c.depoimentos.map((x, k) => (k === i ? { ...x, texto: e.target.value } : x)))} className={cn(campo, "py-2 font-normal")} />
            </label>
            <div className="sm:col-span-2">
              <CampoImagem rotuloCampo="Foto" redonda base={base} valor={d.foto} onChange={(v) => set("depoimentos", c.depoimentos.map((x, k) => (k === i ? { ...x, foto: v } : x)))} />
            </div>
            <button type="button" onClick={() => set("depoimentos", c.depoimentos.filter((_, k) => k !== i))} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-destructive hover:underline">
              <Trash2 className="size-4" aria-hidden /> Remover depoimento
            </button>
          </fieldset>
        ))}
        {c.depoimentos.length < 8 && (
          <button type="button" onClick={() => set("depoimentos", [...c.depoimentos, { nome: "", cargo: "", texto: "", foto: null }])} className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">
            <Plus className="size-4" aria-hidden /> Adicionar depoimento
          </button>
        )}
      </Secao>

      <Secao titulo="Galeria" descricao="Até 12 fotos do ambiente e do time.">
        <div className="grid gap-4 sm:grid-cols-2">
          {c.galeria.map((g, i) => (
            <CampoImagem
              key={g.id}
              rotuloCampo={`Foto ${i + 1}`}
              base={base}
              valor={g}
              onChange={(v) => set("galeria", v ? c.galeria.map((x, k) => (k === i ? v : x)) : c.galeria.filter((_, k) => k !== i))}
            />
          ))}
          {c.galeria.length < 12 && <CampoImagem key={`nova-${c.galeria.length}`} rotuloCampo="Nova foto" base={base} valor={null} onChange={(v) => v && set("galeria", [...c.galeria, v])} />}
        </div>
      </Secao>

      <Secao titulo="Banco de talentos" descricao="Convite para quem não encontrou a vaga ideal, levando a uma vaga publicada que funcione como banco de talentos.">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.bancoTalentos.ativo} onChange={(e) => set("bancoTalentos", { ...c.bancoTalentos, ativo: e.target.checked })} className="size-4 accent-[var(--primary)]" /> Mostrar chamada para o banco de talentos
        </label>
        {c.bancoTalentos.ativo && (
          <label className={rotulo}>
            Vaga do banco de talentos
            <select value={c.bancoTalentos.vagaSlug} onChange={(e) => set("bancoTalentos", { ...c.bancoTalentos, vagaSlug: e.target.value })} className={cn(campo, "h-10 font-normal")}>
              <option value="">Selecione uma vaga publicada…</option>
              {vagas.map((v) => (
                <option key={v.slug} value={v.slug}>
                  {v.titulo}
                </option>
              ))}
            </select>
            {!vagas.length && <span className="text-xs font-normal text-muted-foreground">Publique uma vaga (ex.: “Banco de talentos”) para usá-la aqui.</span>}
          </label>
        )}
        {c.bancoTalentos.ativo && (
          <label className={rotulo}>
            Texto da chamada
            <input value={c.bancoTalentos.texto} maxLength={300} placeholder="Não encontrou a vaga que procurava? Participe do nosso banco de talentos." onChange={(e) => set("bancoTalentos", { ...c.bancoTalentos, texto: e.target.value })} className={cn(campo, "h-10 font-normal")} />
          </label>
        )}
      </Secao>

      <Secao titulo="Conheça mais" descricao="Links oficiais da empresa (https).">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["site", "Site"],
              ["linkedin", "LinkedIn"],
              ["instagram", "Instagram"],
              ["facebook", "Facebook"],
            ] as const
          ).map(([k, r]) => (
            <label key={k} className={rotulo}>
              {r}
              <input type="url" value={c.links[k]} maxLength={300} placeholder="https://" onChange={(e) => set("links", { ...c.links, [k]: e.target.value })} className={cn(campo, "h-10 font-normal")} />
            </label>
          ))}
        </div>
      </Secao>

      {erro && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      <div>
        <button type="button" onClick={salvar} disabled={pendente} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {pendente && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar página
        </button>
      </div>
    </div>
  );
}
