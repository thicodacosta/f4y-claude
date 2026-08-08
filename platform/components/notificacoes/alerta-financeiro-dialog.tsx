"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { marcarNotificacaoLida } from "@/modules/notificacoes/actions";
import type { NotificacaoClient } from "@/components/notificacoes/notification-bell";

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Diferente do sino (mostra tudo, sem interromper) — este pop-up abre
 * sozinho quando existe pendência financeira não lida (NF/fim de alocação,
 * ver modules/financeiro/alertas.ts), porque o pedido foi um alerta que
 * "sempre" chama atenção, não só um badge no topo. */
export function AlertaFinanceiroDialog({ notificacoes }: { notificacoes: NotificacaoClient[] }) {
  const router = useRouter();
  const alertas = notificacoes.filter((n) => !n.lida && n.link === "/financeiro");
  const [open, setOpen] = useState(alertas.length > 0);
  const [, startTransition] = useTransition();

  if (alertas.length === 0) return null;

  function fechar() {
    setOpen(false);
    startTransition(() => {
      alertas.forEach((a) => marcarNotificacaoLida(a.id));
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pendências financeiras</DialogTitle>
          <DialogDescription>
            {alertas.length === 1 ? "1 pendência precisa de atenção." : `${alertas.length} pendências precisam de atenção.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {alertas.map((a) => (
            <div key={a.id} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{a.titulo}</p>
              {a.corpo && <p className="text-xs text-muted-foreground">{a.corpo}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">{dataHora.format(new Date(a.criadoEm))}</p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fechar}>
            Ok, entendi
          </Button>
          <Button
            onClick={() => {
              fechar();
              router.push("/financeiro");
            }}
          >
            Ir para Financeiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
