"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Code2, Link2, Mail, MapPin, Phone, Globe, MessageCircle } from "lucide-react";
import { waLink } from "@/lib/whatsapp";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { disponibilidadeLabel, statusCandidatoLabel } from "@/modules/ats/schemas";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import type { CandidatoClient } from "@/modules/ats/serialize";
import { AbordagemConfidencial } from "@/components/executive-search/abordagem-confidencial";
import { ConvidarCandidatoPortalButton } from "@/components/ats/convidar-candidato-portal-button";
import { EdicoesPerfilReview, type EdicaoPerfilClient } from "@/components/ats/edicoes-perfil-review";
import { TimelineUnificada, type TimelineItemClient } from "@/components/timeline/timeline-unificada";
import { ResumirCurriculoButton } from "@/components/ats/resumir-curriculo-button";
import { CalcularScoreButton } from "@/components/ats/calcular-score-button";
import { EnviarEmailCandidatoButton } from "@/components/ats/enviar-email-candidato-button";
import { EnviarWhatsappCandidatoButton } from "@/components/ats/enviar-whatsapp-candidato-button";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function initials(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

type Processo = {
  id: string;
  etapa: string;
  criadoEm: string;
  fitScore: number | null;
  vaga: { id: string; cargo: string; vertical: string; empresa: { nome: string } };
};

function ListaGenerica({ itens, vazio }: { itens: unknown; vazio: string }) {
  if (!Array.isArray(itens) || itens.length === 0) {
    return <p className="text-sm text-muted-foreground">{vazio}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {itens.map((item, i) => {
        const registro = item as Record<string, unknown>;
        return (
          <div key={i} className="rounded-md border border-border p-3 text-sm">
            {Object.entries(registro).map(([chave, valor]) => (
              <p key={chave}>
                <span className="font-medium capitalize">{chave}: </span>
                {String(valor)}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

type Abordagem = {
  id: string;
  conteudo: string;
  criadoEm: Date | string;
  autor: { nome: string } | null;
};

export function CandidatoProfileView({
  candidato,
  processos,
  abordagensConfidenciais,
  temPortal,
  edicoesPendentes,
  timeline,
}: {
  candidato: CandidatoClient;
  processos: Processo[];
  abordagensConfidenciais: Abordagem[] | null;
  temPortal: boolean;
  edicoesPendentes: EdicaoPerfilClient[];
  timeline: TimelineItemClient[];
}) {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push("/candidatos")}>
        <ArrowLeft />
        Voltar
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {initials(candidato.nome)}
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-bold">{candidato.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {candidato.cargoAtual ?? "—"} {candidato.empresaAtual ? `· ${candidato.empresaAtual}` : ""}
            </p>
            {candidato.cidade && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {candidato.cidade}
                {candidato.estado ? `/${candidato.estado}` : ""}
              </span>
            )}
            <div className="flex items-center gap-3 pt-1 text-muted-foreground">
              {candidato.telefone && (
                <a href={`tel:${candidato.telefone}`} title={candidato.telefone}>
                  <Phone className="size-4" />
                </a>
              )}
              {waLink(candidato.whatsapp || candidato.telefone) && (
                <a
                  href={waLink(candidato.whatsapp || candidato.telefone)!}
                  target="_blank"
                  rel="noreferrer"
                  title="Conversar no WhatsApp"
                >
                  <MessageCircle className="size-4" />
                </a>
              )}
              {candidato.email && (
                <a href={`mailto:${candidato.email}`} title={candidato.email}>
                  <Mail className="size-4" />
                </a>
              )}
              {candidato.linkedin && (
                <a href={candidato.linkedin} target="_blank" rel="noreferrer" title="LinkedIn">
                  <Link2 className="size-4" />
                </a>
              )}
              {candidato.github && (
                <a href={candidato.github} target="_blank" rel="noreferrer" title="GitHub">
                  <Code2 className="size-4" />
                </a>
              )}
              {candidato.portfolioUrl && (
                <a href={candidato.portfolioUrl} target="_blank" rel="noreferrer" title="Portfólio">
                  <Globe className="size-4" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{statusCandidatoLabel[candidato.status as keyof typeof statusCandidatoLabel]}</Badge>
          {candidato.scoreIa !== null && <Badge variant="secondary">Score IA {candidato.scoreIa}</Badge>}
          <EnviarEmailCandidatoButton candidatoId={candidato.id} email={candidato.email} />
          <EnviarWhatsappCandidatoButton
            candidatoId={candidato.id}
            telefone={candidato.whatsapp || candidato.telefone}
          />
          <CalcularScoreButton candidatoId={candidato.id} />
          <ConvidarCandidatoPortalButton candidatoId={candidato.id} temAcesso={temPortal} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Resumo (IA)</span>
          <ResumirCurriculoButton candidatoId={candidato.id} />
        </div>
        {candidato.resumoIa && (
          <p className="rounded-md border border-border bg-muted/30 p-3 text-sm italic text-muted-foreground">
            {candidato.resumoIa}
          </p>
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <Tabs defaultValue="experiencia">
          <TabsList>
            <TabsTrigger value="experiencia">Experiência</TabsTrigger>
            <TabsTrigger value="formacao">Formação</TabsTrigger>
            <TabsTrigger value="certificacoes">Certificações</TabsTrigger>
          </TabsList>
          <TabsContent value="experiencia" className="py-3">
            <ListaGenerica itens={candidato.experiencias} vazio="Nenhuma experiência cadastrada ainda." />
          </TabsContent>
          <TabsContent value="formacao" className="py-3">
            <ListaGenerica itens={candidato.formacao} vazio="Nenhuma formação cadastrada ainda." />
          </TabsContent>
          <TabsContent value="certificacoes" className="py-3">
            {candidato.certificacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma certificação cadastrada ainda.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {candidato.certificacoes.map((c) => (
                  <Badge key={c} variant="outline">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-3 text-sm">
          <Campo label="Skills">
            <div className="flex flex-wrap gap-1.5">
              {candidato.skills.length > 0 ? candidato.skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>) : "—"}
            </div>
          </Campo>
          <Campo label="Tecnologias">
            <div className="flex flex-wrap gap-1.5">
              {candidato.tecnologias.length > 0
                ? candidato.tecnologias.map((s) => <Badge key={s} variant="outline">{s}</Badge>)
                : "—"}
            </div>
          </Campo>
          <Campo label="Idiomas">
            {candidato.idiomas.length > 0 ? candidato.idiomas.join(", ") : "—"}
          </Campo>
          <Campo label="Pretensão salarial">
            {candidato.pretensaoSalarial ? currency.format(candidato.pretensaoSalarial) : "—"}
          </Campo>
          <Campo label="Disponibilidade">
            {candidato.disponibilidade
              ? disponibilidadeLabel[candidato.disponibilidade as keyof typeof disponibilidadeLabel]
              : "—"}
          </Campo>
          <Campo label="Currículo">
            {candidato.curriculoUrl ? (
              <a href={candidato.curriculoUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                Ver documento
              </a>
            ) : (
              "—"
            )}
          </Campo>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="font-heading text-lg font-semibold">Processos seletivos</h2>
        {processos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum processo ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {processos.map((p) => (
              <div
                key={p.id}
                onClick={() => router.push(`/vagas/${p.vaga.id}`)}
                className="flex cursor-pointer items-center justify-between rounded-md border border-border p-2.5 text-left text-sm hover:bg-muted/50"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{p.vaga.cargo}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.vaga.empresa.nome} ·{" "}
                    {verticalNegocioLabel[p.vaga.vertical as keyof typeof verticalNegocioLabel]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {p.fitScore !== null && <Badge variant="secondary">Fit {p.fitScore}%</Badge>}
                  <CalcularScoreButton candidatoId={candidato.id} vagaId={p.vaga.id} />
                  <Badge variant="outline">{p.etapa}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        {candidato.observacoes && (
          <>
            <h3 className="pt-2 text-sm font-semibold">Observações</h3>
            <p className="text-sm text-muted-foreground">{candidato.observacoes}</p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="font-heading text-lg font-semibold">Timeline unificada</h2>
        <TimelineUnificada itens={timeline} />
      </div>

      <EdicoesPerfilReview edicoes={edicoesPendentes} />

      {abordagensConfidenciais !== null && (
        <AbordagemConfidencial candidatoId={candidato.id} abordagensIniciais={abordagensConfidenciais} />
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border p-2.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
