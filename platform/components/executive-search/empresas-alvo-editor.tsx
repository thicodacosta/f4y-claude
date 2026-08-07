"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { atualizarEmpresasAlvo } from "@/modules/executive-search/actions";

export function EmpresasAlvoEditor({ vagaId, empresasAlvo }: { vagaId: string; empresasAlvo: string[] }) {
  const [empresas, setEmpresas] = useState(empresasAlvo);
  const [novaEmpresa, setNovaEmpresa] = useState("");
  const [isPending, startTransition] = useTransition();

  function salvar(novasEmpresas: string[]) {
    setEmpresas(novasEmpresas);
    startTransition(async () => {
      try {
        await atualizarEmpresasAlvo({ vagaId, empresasAlvo: novasEmpresas });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o mapeamento.");
      }
    });
  }

  function adicionar() {
    const nome = novaEmpresa.trim();
    if (!nome || empresas.includes(nome)) return;
    salvar([...empresas, nome]);
    setNovaEmpresa("");
  }

  function remover(nome: string) {
    salvar(empresas.filter((e) => e !== nome));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Empresas-alvo do mapeamento de mercado — sem publicar a vaga (fluxos-usuario.md #3, passo 2).
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Nome da empresa-alvo…"
          value={novaEmpresa}
          onChange={(e) => setNovaEmpresa(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
        />
        <Button type="button" size="sm" disabled={!novaEmpresa.trim() || isPending} onClick={adicionar}>
          {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Adicionar
        </Button>
      </div>
      {empresas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma empresa-alvo mapeada ainda.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {empresas.map((nome) => (
            <Badge key={nome} variant="outline" className="gap-1 pr-1">
              {nome}
              <button
                type="button"
                onClick={() => remover(nome)}
                className="rounded-full hover:bg-muted"
                aria-label={`Remover ${nome}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
