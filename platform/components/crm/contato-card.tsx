import { Mail, MessageCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { waLink } from "@/lib/whatsapp";
import { tipoContatoLabel, nivelContatoLabel } from "@/modules/crm/schemas";
import type { ContatoClient } from "@/modules/crm/serialize";

/** Iniciais pro avatar — ignora tokens sem nenhuma letra (emoji decorativo
 * no início do nome, comum nos contatos importados da planilha de
 * prospecção, ex.: "🌹 Patricia Ruppel") em vez de virar um glifo quebrado. */
function iniciais(nome: string) {
  const palavras = nome.split(/\s+/).filter((p) => /\p{L}/u.test(p));
  return palavras
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function ContatoCard({ contato }: { contato: ContatoClient }) {
  const link = waLink(contato.telefone);
  const tipoLabel = contato.tipo ? tipoContatoLabel[contato.tipo as keyof typeof tipoContatoLabel] : null;
  const nivelLabel = contato.nivel ? nivelContatoLabel[contato.nivel as keyof typeof nivelContatoLabel] : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-3 text-sm font-bold text-primary-foreground">
          {iniciais(contato.nome)}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-heading text-sm font-bold">{contato.nome}</span>
          <span className="truncate text-xs text-muted-foreground">{contato.cargo ?? "—"}</span>
        </div>
      </div>

      <span className="font-heading text-sm font-semibold">{contato.empresaNome ?? "—"}</span>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {tipoLabel && <span className="font-medium">{tipoLabel}</span>}
        {nivelLabel && <Badge variant="secondary">{nivelLabel}</Badge>}
        {contato.cidade && <span className="font-medium text-muted-foreground">{contato.cidade}</span>}
      </div>

      <div className="flex items-center gap-4 border-t border-border pt-3 text-xs">
        <a
          href={contato.email ? `mailto:${contato.email}` : undefined}
          className={
            contato.email
              ? "flex items-center gap-1.5 text-foreground hover:text-primary"
              : "flex cursor-not-allowed items-center gap-1.5 text-muted-foreground/40"
          }
          aria-disabled={!contato.email}
        >
          <Mail className="size-3.5" />
          Email
        </a>
        <a
          href={link ?? undefined}
          target={link ? "_blank" : undefined}
          rel={link ? "noreferrer" : undefined}
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
          href={contato.linkedin ?? undefined}
          target={contato.linkedin ? "_blank" : undefined}
          rel={contato.linkedin ? "noreferrer" : undefined}
          className={
            contato.linkedin
              ? "flex items-center gap-1.5 text-foreground hover:text-primary"
              : "flex cursor-not-allowed items-center gap-1.5 text-muted-foreground/40"
          }
          aria-disabled={!contato.linkedin}
        >
          <ExternalLink className="size-3.5" />
          LinkedIn
        </a>
      </div>
    </div>
  );
}
