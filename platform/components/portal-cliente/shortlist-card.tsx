"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { enviarFeedbackCandidato } from "@/modules/portal-cliente/actions";

export type ShortlistCandidatoClient = {
  id: string;
  etapa: string;
  fitScore: number | null;
  feedbackCliente: string | null;
  comentarioCliente: string | null;
  candidato: {
    nome: string;
    cargoAtual: string | null;
    empresaAtual: string | null;
    resumoIa: string | null;
    skills: string[];
  };
};

export function ShortlistCard({ candidato }: { candidato: ShortlistCandidatoClient }) {
  const [comentario, setComentario] = useState(candidato.comentarioCliente ?? "");
  const [isPending, startTransition] = useTransition();

  function enviar(feedback: "aprovado" | "reprovado") {
    startTransition(async () => {
      try {
        await enviarFeedbackCandidato({ vagaCandidatoId: candidato.id, feedback, comentario });
        toast.success(feedback === "aprovado" ? "Aprovação enviada." : "Reprovação enviada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível enviar o feedback.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-semibold">{candidato.candidato.nome}</span>
          <p className="text-sm text-muted-foreground">
            {candidato.candidato.cargoAtual ?? "—"}
            {candidato.candidato.empresaAtual ? ` · ${candidato.candidato.empresaAtual}` : ""}
          </p>
        </div>
        {candidato.feedbackCliente && (
          <Badge variant={candidato.feedbackCliente === "aprovado" ? "default" : "destructive"}>
            {candidato.feedbackCliente === "aprovado" ? "Aprovado" : "Reprovado"}
          </Badge>
        )}
      </div>

      {candidato.candidato.resumoIa && <p className="text-sm">{candidato.candidato.resumoIa}</p>}
      {candidato.candidato.skills.length > 0 && (
        <p className="text-xs text-muted-foreground">{candidato.candidato.skills.join(" · ")}</p>
      )}

      <Textarea
        placeholder="Comentário para a Find4You (opcional)"
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={2}
      />

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => enviar("reprovado")}>
          {isPending ? <Loader2 className="animate-spin" /> : <ThumbsDown />}
          Reprovar
        </Button>
        <Button size="sm" disabled={isPending} onClick={() => enviar("aprovado")}>
          {isPending ? <Loader2 className="animate-spin" /> : <ThumbsUp />}
          Aprovar
        </Button>
      </div>
    </div>
  );
}
