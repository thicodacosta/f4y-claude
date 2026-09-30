import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Briefcase, MapPin } from "lucide-react";
import { orgPublica, vagaPublica } from "@/lib/carreiras/publico";
import { caminhoVagaPublica, nomeContratacao, nomeModalidade, recebeCandidaturas } from "@/lib/carreiras/regras";
import { FormCandidatura } from "@/components/carreiras/form-candidatura";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ org: string; vaga: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await params;
  const org = await orgPublica(p.org);
  const v = org ? await vagaPublica(org.id, p.vaga) : null;
  if (!org || !v) return { title: "Vaga não encontrada", robots: { index: false } };
  const aberta = recebeCandidaturas(v);
  return {
    title: `${v.titulo} — ${org.nome}`,
    description: (v.descricao ?? `Vaga ${v.titulo} em ${org.nome}.`).slice(0, 155),
    alternates: { canonical: caminhoVagaPublica(org.slug, v.slug) },
    robots: aberta ? undefined : { index: false },
  };
}

export default async function VagaPublicaPage({ params }: Params) {
  const p = await params;
  const org = await orgPublica(p.org);
  if (!org) notFound();
  const v = await vagaPublica(org.id, p.vaga);
  if (!v) notFound();
  const cor = org.corMarca && /^#[0-9a-fA-F]{6}$/.test(org.corMarca) ? org.corMarca : "#0B1F3A";
  const aberta = recebeCandidaturas(v);
  // Dados estruturados (schema.org JobPosting) só para vagas que recebem candidaturas.
  const jsonLd = aberta
    ? {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: v.titulo,
        description: [v.descricao, v.requisitos].filter(Boolean).join("\n\n") || v.titulo,
        datePosted: (v.publicadaEm ?? new Date()).toISOString().slice(0, 10),
        hiringOrganization: { "@type": "Organization", name: org.nome },
        ...(v.local ? { jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: v.local, addressCountry: "BR" } } } : {}),
        ...(v.modelo === "remoto" ? { jobLocationType: "TELECOMMUTE" } : {}),
      }
    : null;

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <Link href={`/carreiras/${org.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Todas as vagas de {org.nome}
      </Link>
      <article className="flex flex-col gap-4">
        <header>
          <h1 className="font-heading text-3xl font-bold">{v.titulo}</h1>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {v.local && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden /> {v.local}
              </span>
            )}
            {nomeModalidade(v.modelo) && (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="size-4" aria-hidden /> {nomeModalidade(v.modelo)}
              </span>
            )}
            {nomeContratacao(v.tipoContratacao) && <span>{nomeContratacao(v.tipoContratacao)}</span>}
          </p>
        </header>
        {v.descricao && (
          <section aria-labelledby="sobre">
            <h2 id="sobre" className="mb-2 font-heading text-lg font-bold">
              Sobre a vaga
            </h2>
            <p className="leading-relaxed whitespace-pre-line text-muted-foreground">{v.descricao}</p>
          </section>
        )}
        {v.requisitos && (
          <section aria-labelledby="requisitos">
            <h2 id="requisitos" className="mb-2 font-heading text-lg font-bold">
              Requisitos
            </h2>
            <p className="leading-relaxed whitespace-pre-line text-muted-foreground">{v.requisitos}</p>
          </section>
        )}
      </article>
      {aberta ? (
        <FormCandidatura orgSlug={org.slug} vagaSlug={v.slug} titulo={v.titulo} org={org.nome} cor={cor} />
      ) : (
        <p role="status" className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Esta vaga não está recebendo candidaturas.{" "}
          <Link href={`/carreiras/${org.slug}`} className="font-medium text-teal-strong hover:underline">
            Veja as vagas abertas
          </Link>
          .
        </p>
      )}
    </>
  );
}
