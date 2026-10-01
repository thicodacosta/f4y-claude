import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Briefcase, Check, ExternalLink, MapPin, Quote } from "lucide-react";
import { conteudoPublico, orgPublica, vagasPublicas } from "@/lib/carreiras/publico";
import { caminhoVagaPublica, MODALIDADE, nomeContratacao, nomeModalidade, TIPO_CONTRATACAO } from "@/lib/carreiras/regras";
import type { ImagemRef } from "@/lib/carreiras/pagina";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ org: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const org = await orgPublica((await params).org);
  if (!org) return { title: "Página não encontrada", robots: { index: false } };
  const c = await conteudoPublico(org.id);
  const descricao = (c.capa.subtitulo || c.sobre.texto || `Vagas abertas em ${org.nome}. Candidate-se sem criar conta.`).slice(0, 155);
  return {
    title: `Carreiras — ${org.nome}`,
    description: descricao,
    alternates: { canonical: `/carreiras/${org.slug}` },
    openGraph: { title: `Carreiras — ${org.nome}`, description: descricao, ...(c.capa.imagem ? { images: [`/carreiras/${org.slug}/midia/${c.capa.imagem.id}`] } : {}) },
  };
}

function Imagem({ base, img, className, prioridade }: { base: string; img: ImagemRef; className?: string; prioridade?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`${base}/midia/${img.id}`} alt={img.alt} loading={prioridade ? "eager" : "lazy"} decoding="async" className={cn("size-full object-cover", className)} />;
}

/** Texto e imagem lado a lado (a imagem troca de lado conforme a configuração). */
function TextoImagem({ id, titulo, texto, img, lado, base }: { id?: string; titulo: string; texto: string; img: ImagemRef | null; lado: "esquerda" | "direita"; base: string }) {
  if (!titulo && !texto && !img) return null;
  return (
    <section id={id} aria-labelledby={id ? `${id}-t` : undefined} className="mx-auto grid w-full max-w-6xl scroll-mt-20 items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:gap-12">
      <div className={cn("flex flex-col gap-4", img && lado === "esquerda" && "md:order-2")}>
        {titulo && (
          <h2 id={id ? `${id}-t` : undefined} className="font-heading text-2xl leading-tight font-bold sm:text-3xl">
            {titulo}
          </h2>
        )}
        {texto && <p className="leading-relaxed whitespace-pre-line text-muted-foreground">{texto}</p>}
      </div>
      {img && (
        <div className="aspect-[4/3] overflow-hidden rounded-lg border border-border shadow-surface">
          <Imagem base={base} img={img} />
        </div>
      )}
    </section>
  );
}

export default async function CarreirasPublico({ params, searchParams }: Props) {
  const [p, sp] = await Promise.all([params, searchParams]);
  const org = await orgPublica(p.org);
  if (!org) notFound();
  const [c, todas] = await Promise.all([conteudoPublico(org.id), vagasPublicas(org.id)]);
  const base = `/carreiras/${org.slug}`;
  const cor = org.corMarca && /^#[0-9a-fA-F]{6}$/.test(org.corMarca) ? org.corMarca : "#0B1F3A";
  const logo = org.logoUrl && /^https:\/\//.test(org.logoUrl) ? org.logoUrl : null;

  // Filtros de vagas (GET, sem JavaScript): busca, modalidade, contratação e local.
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 80);
  const modalidade = sp.modalidade && sp.modalidade in MODALIDADE ? sp.modalidade : "";
  const contratacao = sp.contratacao && sp.contratacao in TIPO_CONTRATACAO ? sp.contratacao : "";
  const locais = [...new Set(todas.map((v) => v.local).filter((l): l is string => !!l))].sort();
  const local = sp.local && locais.includes(sp.local) ? sp.local : "";
  const vagas = todas.filter(
    (v) => (!q || v.titulo.toLowerCase().includes(q)) && (!modalidade || v.modelo === modalidade) && (!contratacao || v.tipoContratacao === contratacao) && (!local || v.local === local),
  );
  const filtros = [q, modalidade, contratacao, local].filter(Boolean).length;
  const vagaBanco = c.bancoTalentos.ativo ? todas.find((v) => v.slug === c.bancoTalentos.vagaSlug) : undefined;
  const links = (
    [
      ["site", "Site"],
      ["linkedin", "LinkedIn"],
      ["instagram", "Instagram"],
      ["facebook", "Facebook"],
    ] as const
  ).filter(([k]) => c.links[k]);
  const campo = "h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <>
      {/* Capa */}
      <section aria-label="Capa" className="relative isolate overflow-hidden text-white" style={{ background: cor }}>
        {c.capa.imagem && (
          <div className="absolute inset-0 -z-10">
            <Imagem base={base} img={c.capa.imagem} prioridade />
            <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${cor}f2 0%, ${cor}b3 45%, ${cor}33 100%)` }} aria-hidden />
          </div>
        )}
        <div className="mx-auto flex min-h-[280px] max-w-6xl flex-col justify-end gap-3 px-4 pt-16 pb-14 sm:min-h-[360px] sm:px-6">
          <h1 className="max-w-2xl font-heading text-3xl leading-tight font-bold sm:text-5xl">{c.capa.titulo || `Trabalhe na ${org.nome}`}</h1>
          <p className="max-w-xl text-base opacity-90 sm:text-lg">{c.capa.subtitulo || "Conheça nossas vagas e candidate-se sem criar conta."}</p>
          <div>
            <Link href="#vagas" className="mt-2 inline-flex h-11 items-center rounded-lg bg-white px-5 text-sm font-semibold hover:bg-white/90" style={{ color: cor }}>
              Ver vagas abertas
            </Link>
          </div>
        </div>
      </section>

      {/* Identidade */}
      <div className="relative z-10 mx-auto -mt-10 flex w-full max-w-6xl items-end gap-4 px-4 sm:px-6">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card p-2 shadow-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt="" className="max-h-full max-w-full object-contain" /> : <span className="font-heading text-2xl font-bold" style={{ color: cor }} aria-hidden>{org.nome.slice(0, 1)}</span>}
        </div>
        <p className="pb-1 font-heading text-xl font-bold">{org.nome}</p>
      </div>

      <TextoImagem id="sobre" titulo={c.sobre.titulo} texto={c.sobre.texto} img={c.sobre.imagem} lado={c.sobre.lado} base={base} />

      {/* Vagas */}
      <section id="vagas" aria-labelledby="vagas-t" className="w-full scroll-mt-20 bg-muted/40 py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 sm:px-6">
          <div>
            <h2 id="vagas-t" className="font-heading text-2xl font-bold sm:text-3xl">
              Vagas abertas
            </h2>
            <p className="text-sm text-muted-foreground">Candidate-se sem criar conta: basta seus dados de contato e o currículo.</p>
          </div>
          {todas.length > 0 && (
            <form role="search" action="#vagas" className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-surface sm:grid-cols-2 lg:grid-cols-[1fr_repeat(3,minmax(0,11rem))_auto] lg:items-end">
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Buscar vaga
                <input name="q" defaultValue={sp.q ?? ""} placeholder="Cargo ou palavra-chave" className={cn(campo, "font-normal")} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Modo de trabalho
                <select name="modalidade" defaultValue={modalidade} className={cn(campo, "font-normal")}>
                  <option value="">Todos</option>
                  {Object.entries(MODALIDADE).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Tipo de vaga
                <select name="contratacao" defaultValue={contratacao} className={cn(campo, "font-normal")}>
                  <option value="">Todos</option>
                  {Object.entries(TIPO_CONTRATACAO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Local
                <select name="local" defaultValue={local} className={cn(campo, "font-normal")}>
                  <option value="">Todos</option>
                  {locais.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="h-10 rounded-lg px-5 text-sm font-semibold text-white" style={{ background: cor }}>
                Filtrar
              </button>
            </form>
          )}
          {todas.length > 0 && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {vagas.length} vaga(s) encontrada(s){filtros ? ` com ${filtros} filtro(s)` : ""}.{" "}
              {filtros > 0 && (
                <Link href={`${base}#vagas`} className="font-medium text-teal-strong hover:underline">
                  Limpar filtros
                </Link>
              )}
            </p>
          )}
          {todas.length === 0 ? (
            <div className="rounded-lg border border-dashed border-input bg-card p-10 text-center">
              <p className="font-heading text-lg font-bold">No momento, não há vagas abertas.</p>
              <p className="mt-1 text-sm text-muted-foreground">Volte em breve — novas oportunidades são publicadas nesta página.</p>
            </div>
          ) : vagas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-input bg-card p-6 text-center text-sm text-muted-foreground">Nenhuma vaga com esses filtros.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {vagas.map((v) => (
                <li key={v.id}>
                  <Link href={caminhoVagaPublica(org.slug, v.slug)} className="flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-5 shadow-surface transition-shadow hover:shadow-hover">
                    <span className="font-heading text-lg leading-snug font-bold">{v.titulo}</span>
                    <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {v.local && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-4" aria-hidden /> {v.local}
                        </span>
                      )}
                      {(v.modelo || v.tipoContratacao) && (
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="size-4" aria-hidden /> {[nomeModalidade(v.modelo), nomeContratacao(v.tipoContratacao)].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className="mt-auto pt-1 text-sm font-semibold" style={{ color: cor }}>
                      Ver vaga e candidatar-se →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {vagaBanco && (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6 shadow-surface sm:flex-row sm:items-center sm:justify-between">
              <p className="font-heading text-lg font-bold">{c.bancoTalentos.texto || "Não encontrou a vaga que procurava? Participe do nosso banco de talentos!"}</p>
              <Link href={caminhoVagaPublica(org.slug, vagaBanco.slug)} className="inline-flex h-11 shrink-0 items-center rounded-lg px-5 text-sm font-semibold text-white" style={{ background: cor }}>
                Participar do banco de talentos
              </Link>
            </div>
          )}
        </div>
      </section>

      {c.blocos.map((b, i) => (
        <TextoImagem key={i} titulo={b.titulo} texto={b.texto} img={b.imagem} lado={b.lado} base={base} />
      ))}

      {c.beneficios.itens.length > 0 && (
        <section aria-labelledby="beneficios-t" className="w-full bg-muted/40 py-12">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 sm:px-6">
            <h2 id="beneficios-t" className="font-heading text-2xl font-bold sm:text-3xl">
              {c.beneficios.titulo || "Nossos benefícios"}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.beneficios.itens.map((b, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm shadow-surface">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white" style={{ background: cor }} aria-hidden>
                    <Check className="size-3.5" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {c.depoimentos.length > 0 && (
        <section aria-labelledby="depoimentos-t" className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-12 sm:px-6">
          <h2 id="depoimentos-t" className="font-heading text-2xl font-bold sm:text-3xl">
            O que nosso time diz
          </h2>
          <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3" aria-label="Depoimentos">
            {c.depoimentos.map((d, i) => (
              <li key={i} className="flex w-[85%] shrink-0 snap-start flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-surface sm:w-auto">
                <Quote className="size-6" style={{ color: cor }} aria-hidden />
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{d.texto}</p>
                <div className="flex items-center gap-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-full bg-muted">{d.foto && <Imagem base={base} img={d.foto} />}</div>
                  <div>
                    <p className="font-semibold">{d.nome}</p>
                    {d.cargo && <p className="text-xs text-muted-foreground">{d.cargo}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.galeria.length > 0 && (
        <section aria-labelledby="galeria-t" className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-12 sm:px-6">
          <h2 id="galeria-t" className="font-heading text-2xl font-bold sm:text-3xl">
            Nosso dia a dia
          </h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {c.galeria.map((g, i) => (
              <li key={g.id} className={cn("overflow-hidden rounded-lg border border-border", i % 5 === 0 ? "aspect-[4/5] md:row-span-2 md:aspect-auto" : "aspect-square")}>
                <Imagem base={base} img={g} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {links.length > 0 && (
        <section aria-labelledby="links-t" className="w-full border-t border-border py-10">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:px-6">
            <h2 id="links-t" className="font-heading text-xl font-bold">
              Conheça mais sobre a {org.nome}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {links.map(([k, r]) => (
                <li key={k}>
                  <a href={c.links[k]} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
                    {r} <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
