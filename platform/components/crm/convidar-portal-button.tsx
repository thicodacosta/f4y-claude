"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { convidarClientePortal } from "@/modules/portal/actions";

export function ConvidarContatoPortalButton({
  contatoId,
  temAcesso,
}: {
  contatoId: string;
  temAcesso: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (temAcesso) {
    return <Badge variant="default">Acesso ao portal ativo</Badge>;
  }

  function convidar() {
    startTransition(async () => {
      try {
        await convidarClientePortal({ contatoId });
        toast.success("Convite enviado para o portal do cliente.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível enviar o convite.");
      }
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={isPending} onClick={convidar}>
      {isPending ? <Loader2 className="animate-spin" /> : <Mail />}
      Convidar para o portal
    </Button>
  );
}
