"use client";

import { Printer } from "lucide-react";

/** Salvar como PDF pela impressão do navegador, só com a folha do relatório. */
export function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.classList.add("modo-relatorio");
        const limpar = () => {
          document.documentElement.classList.remove("modo-relatorio");
          window.removeEventListener("afterprint", limpar);
        };
        window.addEventListener("afterprint", limpar);
        window.print();
      }}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    >
      <Printer className="size-4" aria-hidden /> Salvar como PDF
    </button>
  );
}
