import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { getEmpresa } from "@/modules/crm/queries";
import { getEmailsComPortalNaEmpresa } from "@/modules/portal/queries";
import { getTimelineUnificadaEmpresa } from "@/modules/timeline/queries";
import { ConvidarContatoPortalButton } from "@/components/crm/convidar-portal-button";
import { TimelineUnificada } from "@/components/timeline/timeline-unificada";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { waLink } from "@/lib/whatsapp";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  ativo: "default",
  prospect: "secondary",
  inativo: "outline",
};

export default async function EmpresaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empresa = await getEmpresa(id);
  if (!empresa) notFound();

  const [emailsComPortal, timeline] = await Promise.all([
    getEmailsComPortalNaEmpresa(id),
    getTimelineUnificadaEmpresa(id),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/empresas">
        <Button variant="ghost" size="sm" className="w-fit">
          <ArrowLeft />
          Voltar
        </Button>
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">{empresa.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {empresa.segmento ?? "—"}
            {empresa.cidade ? ` · ${empresa.cidade}${empresa.estado ? "/" + empresa.estado : ""}` : ""}
          </p>
        </div>
        <Badge variant={statusVariant[empresa.status] ?? "outline"}>{empresa.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Oportunidades</p>
          <p className="text-xl font-semibold tabular-nums">{empresa._count.oportunidades}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Vagas</p>
          <p className="text-xl font-semibold tabular-nums">{empresa._count.vagas}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-heading text-sm font-semibold">Contatos</h2>
        {empresa.contatos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum contato cadastrado ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {empresa.contatos.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {c.nome}
                    {c.principal && (
                      <Badge variant="secondary" className="ml-2">
                        Principal
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {c.cargo ?? "—"} · {c.email ?? "sem e-mail"} · {c.telefone ?? "sem telefone"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {waLink(c.telefone) && (
                    <a
                      href={waLink(c.telefone)!}
                      target="_blank"
                      rel="noreferrer"
                      title="Conversar no WhatsApp"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <MessageCircle className="size-4" />
                    </a>
                  )}
                  <ConvidarContatoPortalButton
                    contatoId={c.id}
                    temAcesso={!!c.email && emailsComPortal.has(c.email)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-heading text-sm font-semibold">Timeline unificada</h2>
        <p className="text-xs text-muted-foreground">
          Todas as interações com esta empresa — comercial, recrutamento e alocação — em uma única linha do tempo.
        </p>
        <TimelineUnificada itens={timeline} />
      </div>
    </div>
  );
}
