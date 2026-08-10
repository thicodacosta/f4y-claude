"use client";

import { useRouter } from "next/navigation";
import { Mail, MessageCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { waLink } from "@/lib/whatsapp";
import { disponibilidadeLabel, statusCandidatoLabel } from "@/modules/ats/schemas";
import type { CandidatoClient } from "@/modules/ats/serialize";

/** Mesmo formato de iniciais do ContatoCard (components/crm/contato-card.tsx)
 * — cards de Candidatos e Contatos devem ser visualmente idênticos. */
function iniciais(nome: string) {
  const palavras = nome.split(/\s+/).filter((p) => /\p{L}/u.test(p));
  return palavras
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function CandidatoCard({ candidato }: { candidato: CandidatoClient }) {
  const router = useRouter();
  const link = waLink(candidato.whatsapp ?? candidato.telefone);
  const statusLabel = statusCandidatoLabel[candidato.status as keyof typeof statusCandidatoLabel];
  const disponibilidadeLabelValue = candidato.disponibilidade
    ? disponibilidadeLabel[candidato.disponibilidade as keyof typeof disponibilidadeLabel]
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/candidatos/${candidato.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/candidatos/${candidato.id}`);
      }}
      className="flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-3 text-sm font-bold text-primary-foreground">
          {iniciais(candidato.nome)}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-heading text-sm font-bold">{candidato.nome}</span>
          <span className="truncate text-xs text-muted-foreground">{candidato.cargoAtual ?? "—"}</span>
        </div>
      </div>

      <span className="font-heading text-sm font-semibold">{candidato.empresaAtual ?? "—"}</span>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {statusLabel && <span className="font-medium">{statusLabel}</span>}
        {disponibilidadeLabelValue && <Badge variant="secondary">{disponibilidadeLabelValue}</Badge>}
        {candidato.cidade && (
          <span className="font-medium text-muted-foreground">
            {candidato.cidade}
            {candidato.estado ? `/${candidato.estado}` : ""}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-border pt-3 text-xs">
        <a
          href={candidato.email ? `mailto:${candidato.email}` : undefined}
          onClick={(e) => e.stopPropagation()}
          className={
            candidato.email
              ? "flex items-center gap-1.5 text-foreground hover:text-primary"
              : "flex cursor-not-allowed items-center gap-1.5 text-muted-foreground/40"
          }
          aria-disabled={!candidato.email}
        >
          <Mail className="size-3.5" />
          Email
        </a>
        <a
          href={link ?? undefined}
          target={link ? "_blank" : undefined}
          rel={link ? "noreferrer" : undefined}
          onClick={(e) => e.stopPropagation()}
          className={
            link
              ? "flex items-center gap-1.5 text-foreground hover:text-primary"
              : "flex cursor-not-allowed items-center gap-1.5 text-muted-foreground/40"
          }
          aria-disabled={!link}
        >
          <MessageCircle className="size-3.5" />
          WhatsApp
        </a>
        <a
          href={candidato.linkedin ?? undefined}
          target={candidato.linkedin ? "_blank" : undefined}
          rel={candidato.linkedin ? "noreferrer" : undefined}
          onClick={(e) => e.stopPropagation()}
          className={
            candidato.linkedin
              ? "flex items-center gap-1.5 text-foreground hover:text-primary"
              : "flex cursor-not-allowed items-center gap-1.5 text-muted-foreground/40"
          }
          aria-disabled={!candidato.linkedin}
        >
          <ExternalLink className="size-3.5" />
          LinkedIn
        </a>
      </div>
    </div>
  );
}
