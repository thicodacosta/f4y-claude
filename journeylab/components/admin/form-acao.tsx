"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { EstadoForm } from "@/lib/auth/actions";
import { Mensagem } from "@/components/auth/formularios";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Formulário ligado a uma Server Action que devolve { erro | ok }. */
export function FormAcao({
  action,
  children,
  textoBotao = "Salvar",
  variante = "default",
  limparAoConcluir = false,
  className,
}: {
  action: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  children: React.ReactNode;
  textoBotao?: string;
  variante?: "default" | "outline" | "destructive";
  limparAoConcluir?: boolean;
  className?: string;
}) {
  const [estado, acao, pendente] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok && limparAoConcluir) ref.current?.reset();
  }, [estado, limparAoConcluir]);

  return (
    <form ref={ref} action={acao} className={cn("flex flex-col gap-4", className)}>
      {children}
      <Mensagem estado={estado} />
      <div>
        <Button type="submit" variant={variante} size="lg" className="h-10 px-5" disabled={pendente}>
          {pendente && <Loader2 className="animate-spin" />}
          {textoBotao}
        </Button>
      </div>
    </form>
  );
}
