"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ResumirCurriculoButton({ candidatoId }: { candidatoId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function resumir() {
    setIsPending(true);
    try {
      const res = await fetch("/api/ia/resumir-curriculo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidatoId }),
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => null);
        throw new Error(erro?.erro ?? "Não foi possível resumir o currículo.");
      }
      toast.success("Resumo gerado.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível resumir o currículo.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={resumir}>
      {isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      Resumir currículo com IA
    </Button>
  );
}
