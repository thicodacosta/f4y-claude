"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adicionarCandidatoAVaga } from "@/modules/ats/actions";

type Sugestao = {
  candidatoId: string;
  score: number;
  justificativa: string;
  nome: string;
  cargoAtual: string | null;
  skills: string[];
};

/** Fase 8 — critério de pronto do plano-modulos.md: o recrutador usa a
 * sugestão de matching em vagas reais. Cada sugestão carrega score +
 * justificativa (explicabilidade, ver diferenciais.md #5); a auditoria só é
 * persistida se "Adicionar ao processo" for clicado (ver
 * app/api/ia/matching/route.ts). */
export function MatchingPanel({ vagaId }: { vagaId: string }) {
  const router = useRouter();
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null);
  const [modelo, setModelo] = useState<string>("");
  const [carregando, setCarregando] = useState(false);
  const [adicionandoId, setAdicionandoId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function buscarSugestoes() {
    setCarregando(true);
    try {
      const res = await fetch("/api/ia/matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vagaId }),
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => null);
        throw new Error(erro?.erro ?? "Não foi possível buscar sugestões.");
      }
      const data = (await res.json()) as { candidatos: Sugestao[]; modelo: string };
      setSugestoes(data.candidatos);
      setModelo(data.modelo);
      if (data.candidatos.length === 0) {
        toast.info("Nenhum candidato disponível fora deste processo no momento.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível buscar sugestões.");
    } finally {
      setCarregando(false);
    }
  }

  function adicionar(s: Sugestao) {
    setAdicionandoId(s.candidatoId);
    startTransition(async () => {
      try {
        await adicionarCandidatoAVaga({
          vagaId,
          candidatoId: s.candidatoId,
          fitScore: s.score,
          fitScoreJustificativa: s.justificativa,
          fitScoreModelo: modelo,
        });
        toast.success(`${s.nome} adicionado ao processo.`);
        setSugestoes((prev) => prev?.filter((x) => x.candidatoId !== s.candidatoId) ?? null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível adicionar o candidato.");
      } finally {
        setAdicionandoId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Candidatos do pool que ainda não estão neste processo, ranqueados por aderência à vaga.
        </p>
        <Button type="button" size="sm" variant="outline" disabled={carregando} onClick={buscarSugestoes}>
          {carregando ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Buscar sugestões
        </Button>
      </div>

      {sugestoes && sugestoes.length > 0 && (
        <div className="flex flex-col gap-2">
          {sugestoes.map((s) => (
            <div key={s.candidatoId} className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-semibold">{s.nome}</span>
                  <p className="text-xs text-muted-foreground">{s.cargoAtual ?? "—"}</p>
                </div>
                <Badge variant="secondary">Score {s.score}%</Badge>
              </div>
              <p className="text-sm">{s.justificativa}</p>
              {s.skills.length > 0 && <p className="text-xs text-muted-foreground">{s.skills.join(" · ")}</p>}
              <Button
                type="button"
                size="sm"
                className="self-end"
                disabled={isPending && adicionandoId === s.candidatoId}
                onClick={() => adicionar(s)}
              >
                {isPending && adicionandoId === s.candidatoId ? <Loader2 className="animate-spin" /> : <Plus />}
                Adicionar ao processo
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
