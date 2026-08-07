"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import { senioridadeLabel } from "@/modules/ats/schemas";
import type { VagaClient, VagaCandidatoClient } from "@/modules/ats/serialize";

const ETAPAS_SHORTLIST = new Set(["entrevista_cliente", "forecast", "fechada"]);

const dataCurta = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });

export function RelatorioPosicaoView({
  vaga,
  candidatos,
}: {
  vaga: VagaClient;
  candidatos: VagaCandidatoClient[];
}) {
  const router = useRouter();
  const shortlist = candidatos.filter((c) => ETAPAS_SHORTLIST.has(c.etapa));

  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 print:max-w-none print:px-0">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/vagas/${vaga.id}`)}>
          <ArrowLeft />
          Voltar
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer />
          Imprimir / Exportar PDF
        </Button>
      </div>

      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Relatório de posição — confidencial</span>
        <h1 className="font-heading text-2xl font-bold">{vaga.cargo}</h1>
        <p className="text-sm text-muted-foreground">
          {vaga.empresaNome} · {verticalNegocioLabel[vaga.vertical as keyof typeof verticalNegocioLabel]}
          {vaga.senioridade ? ` · ${senioridadeLabel[vaga.senioridade as keyof typeof senioridadeLabel]}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">Gerado em {dataCurta.format(new Date())}</p>
      </div>

      {vaga.jobDescription && (
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-sm font-semibold">Descrição da posição</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{vaga.jobDescription}</p>
        </div>
      )}

      {vaga.skillsRequeridas.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-sm font-semibold">Requisitos</h2>
          <p className="text-sm text-muted-foreground">{vaga.skillsRequeridas.join(" · ")}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-sm font-semibold">Shortlist ({shortlist.length})</h2>
        {shortlist.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum candidato em etapa de shortlist ainda (Entrevista Cliente, Forecast ou Fechada).
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {shortlist.map((c) => (
              <div key={c.id} className="flex flex-col gap-1 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{c.candidato.nome}</span>
                  {c.fitScore !== null && <span className="text-xs text-muted-foreground">Fit {c.fitScore}%</span>}
                </div>
                <span className="text-sm text-muted-foreground">
                  {c.candidato.cargoAtual ?? "—"}
                  {c.candidato.empresaAtual ? ` · ${c.candidato.empresaAtual}` : ""}
                </span>
                {c.candidato.resumoIa && <p className="text-sm">{c.candidato.resumoIa}</p>}
                {c.candidato.skills.length > 0 && (
                  <p className="text-xs text-muted-foreground">{c.candidato.skills.join(" · ")}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
        Documento confidencial — Find4You Executive Search. Não distribuir fora do contexto do processo seletivo.
      </p>
    </div>
  );
}
