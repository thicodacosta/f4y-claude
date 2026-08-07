"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { marcarNotificacaoLida, marcarTodasNotificacoesLidas } from "@/modules/notificacoes/actions";

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export type NotificacaoClient = {
  id: string;
  titulo: string;
  corpo: string | null;
  link: string | null;
  lida: boolean;
  criadoEm: string;
};

export function NotificationBell({ notificacoes }: { notificacoes: NotificacaoClient[] }) {
  const router = useRouter();
  const [items, setItems] = useState(notificacoes);
  const [, startTransition] = useTransition();
  const naoLidas = items.filter((n) => !n.lida).length;

  function abrir(n: NotificacaoClient) {
    if (!n.lida) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, lida: true } : i)));
      startTransition(() => marcarNotificacaoLida(n.id));
    }
    if (n.link) router.push(n.link);
  }

  function marcarTodas() {
    setItems((prev) => prev.map((i) => ({ ...i, lida: true })));
    startTransition(() => marcarTodasNotificacoesLidas());
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground outline-offset-2 hover:bg-muted hover:text-foreground"
        aria-label="Notificações"
      >
        <Bell className="size-4" />
        {naoLidas > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-destructive" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          {naoLidas > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={marcarTodas}>
              <CheckCheck className="size-3.5" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <div className="flex max-h-96 flex-col overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma notificação ainda.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => abrir(n)}
                className="flex flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left text-sm last:border-0 hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  {!n.lida && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  <span className={n.lida ? "text-muted-foreground" : "font-medium"}>{n.titulo}</span>
                </div>
                {n.corpo && <p className="text-xs text-muted-foreground">{n.corpo}</p>}
                <span className="text-[11px] text-muted-foreground">{dataHora.format(new Date(n.criadoEm))}</span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
