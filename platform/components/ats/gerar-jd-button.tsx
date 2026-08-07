"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type RespostaIa = { jobDescription: string; skillsSugeridas: string[] };

/** Botão reaproveitado por nova-vaga-dialog e editar-vaga-dialog — o
 * recrutador sempre revisa/edita o texto gerado antes de salvar a vaga (ver
 * comentário em app/api/ia/gerar-jd/route.ts sobre por que não há trilha de
 * auditoria própria aqui). */
export function GerarJdButton({
  getFormValues,
  onGerado,
}: {
  getFormValues: () => {
    cargo?: string;
    senioridade?: string | null;
    stackTecnologica?: string[];
    modeloTrabalho?: string | null;
    empresaId?: string | null;
  };
  onGerado: (jobDescription: string, skillsSugeridas: string[]) => void;
}) {
  const [isPending, setIsPending] = useState(false);

  async function gerar() {
    const values = getFormValues();
    if (!values.cargo || !values.empresaId) {
      toast.error("Informe cargo e empresa antes de gerar a JD.");
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch("/api/ia/gerar-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cargo: values.cargo,
          senioridade: values.senioridade,
          stack: values.stackTecnologica,
          modeloTrabalho: values.modeloTrabalho,
          empresaId: values.empresaId,
        }),
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => null);
        throw new Error(erro?.erro ?? "Não foi possível gerar a JD.");
      }
      const data = (await res.json()) as RespostaIa;
      onGerado(data.jobDescription, data.skillsSugeridas);
      toast.success("JD gerada — revise antes de salvar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar a JD.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={gerar}>
      {isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      Gerar com IA
    </Button>
  );
}
