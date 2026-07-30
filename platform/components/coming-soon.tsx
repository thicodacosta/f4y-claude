import { findNavItem } from "@/lib/nav";
import { Construction } from "lucide-react";

/**
 * Placeholder para rotas do menu cujo módulo ainda não foi construído — ver
 * docs/business-platform/plano-modulos.md para a fase de cada uma. Existe só
 * para o shell ser totalmente navegável desde a Fase 0, sem simular dado ou
 * lógica de negócio que ainda não existe.
 */
export function ComingSoon({ route }: { route: string }) {
  const item = findNavItem(route);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Construction className="size-5" />
      </div>
      <h1 className="font-heading text-xl font-bold">{item?.label ?? "Módulo"}</h1>
      {item?.descricao && (
        <p className="max-w-md text-sm text-muted-foreground">{item.descricao}</p>
      )}
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Chega na {item?.fase ?? "próxima fase"} do roadmap
      </p>
    </div>
  );
}
