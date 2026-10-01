import { MessageCircle } from "lucide-react";
import { linkWhatsapp } from "@/lib/crm/normalizar";
import { cn } from "@/lib/utils";

/** Telefone clicável que abre a conversa no WhatsApp (nova aba). Sem número válido, mostra só o texto. */
export function TelefoneWhatsapp({ telefone, nome, className }: { telefone: string | null | undefined; nome?: string; className?: string }) {
  if (!telefone) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const href = linkWhatsapp(telefone);
  if (!href) return <span className={className}>{telefone}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Abrir conversa no WhatsApp${nome ? ` com ${nome}` : ""}: ${telefone}`}
      title="Abrir no WhatsApp"
      className={cn("inline-flex items-center gap-1 font-medium text-teal-strong hover:underline", className)}
    >
      <MessageCircle className="size-3.5 shrink-0" aria-hidden />
      {telefone}
    </a>
  );
}
