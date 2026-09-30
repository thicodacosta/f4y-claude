import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Briefcase, MapPin } from "lucide-react";
import { orgPublica, vagasPublicas } from "@/lib/carreiras/publico";
import { caminhoVagaPublica, nomeContratacao, nomeModalidade } from "@/lib/carreiras/regras";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ org: string }> }): Promise<Metadata> {
  const org = await orgPublica((await params).org);
  if (!org) return { title: "Página não encontrada", robots: { index: false } };
  return {
    title: `Carreiras — ${org.nome}`,
    description: `Vagas abertas em ${org.nome}. Candidate-se sem criar conta.`,
    alternates: { canonical: `/carreiras/${org.slug}` },
  };
}

export default async function CarreirasPublico({ params }: { params: Promise<{ org: string }> }) {
  const org = await orgPublica((await params).org);
  if (!org) notFound();
  const vagas = await vagasPublicas(org.id);
  return (
    <>
      <div>
        <h1 className="font-heading text-3xl font-bold">Trabalhe na {org.nome}</h1>
        <p className="mt-1 text-muted-foreground">{vagas.length ? `${vagas.length} vaga(s) aberta(s). Candidate-se sem criar conta.` : "Vagas abertas aparecem aqui."}</p>
      </div>
      {vagas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input bg-card p-10 text-center">
          <p className="font-heading text-lg font-bold">No momento, não há vagas abertas.</p>
          <p className="mt-1 text-sm text-muted-foreground">Volte em breve — novas oportunidades são publicadas nesta página.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {vagas.map((v) => (
            <li key={v.id}>
              <Link href={caminhoVagaPublica(org.slug, v.slug)} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5 shadow-surface transition-shadow hover:shadow-hover sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block font-heading text-lg font-bold">{v.titulo}</span>
                  <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
                </span>
                <span className="text-sm font-semibold text-teal-strong">Ver vaga →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
