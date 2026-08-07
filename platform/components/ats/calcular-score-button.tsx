"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Calcula o score geral do candidato (sem vagaId) ou o fit dele numa vaga
 * específica (com vagaId) — mesma rota, contrato documentado em apis.md. */
export function CalcularScoreButton({ candidatoId, vagaId }: { candidatoId: string; vagaId?: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function calcular(e: React.MouseEvent) {
    e.stopPropagation();
    setIsPending(true);
    try {
      const res = await fetch("/api/ia/score-candidato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidatoId, vagaId }),
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => null);
        throw new Error(erro?.erro ?? "Não foi possível calcular o score.");
      }
      toast.success("Score calculado.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível calcular o score.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={calcular}>
      {isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {vagaId ? "Calcular fit" : "Calcular score"}
    </Button>
  );
}
