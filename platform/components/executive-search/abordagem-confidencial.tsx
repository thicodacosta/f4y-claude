"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { criarAbordagemConfidencial } from "@/modules/executive-search/actions";

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

type Abordagem = {
  id: string;
  conteudo: string;
  criadoEm: Date | string;
  autor: { nome: string } | null;
};

export function AbordagemConfidencial({
  candidatoId,
  abordagensIniciais,
}: {
  candidatoId: string;
  abordagensIniciais: Abordagem[];
}) {
  const [abordagens, setAbordagens] = useState(abordagensIniciais);
  const [nota, setNota] = useState("");
  const [isPending, startTransition] = useTransition();

  function registrar() {
    if (!nota.trim()) return;
    const conteudo = nota.trim();
    startTransition(async () => {
      try {
        const criada = await criarAbordagemConfidencial({ candidatoId, conteudo });
        setAbordagens((prev) => [criada, ...prev]);
        setNota("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível registrar a abordagem.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold">
        <Lock className="size-3.5" />
        Abordagem confidencial
      </h2>
      <p className="text-xs text-muted-foreground">
        Visível só pra Executive Search — não notifica o candidato nem aparece na busca padrão.
      </p>
      <div className="flex flex-col gap-2">
        <Textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Registrar contato, interesse, disponibilidade…"
          rows={2}
        />
        <Button size="sm" className="self-end" disabled={!nota.trim() || isPending} onClick={registrar}>
          {isPending && <Loader2 className="animate-spin" />}
          Registrar
        </Button>
      </div>
      {abordagens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma abordagem registrada ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {abordagens.map((a) => (
            <div key={a.id} className="flex flex-col gap-1 rounded-md border border-border p-2.5 text-sm">
              <p>{a.conteudo}</p>
              <span className="text-xs text-muted-foreground">
                {a.autor?.nome ?? "—"} · {dataHora.format(new Date(a.criadoEm))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
