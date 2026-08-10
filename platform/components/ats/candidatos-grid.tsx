"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NovoCandidatoDialog } from "@/components/ats/novo-candidato-dialog";
import { CandidatoCard } from "@/components/ats/candidato-card";
import { disponibilidadeValues, disponibilidadeLabel } from "@/modules/ats/schemas";
import type { CandidatoClient } from "@/modules/ats/serialize";

const TODOS = "__todos__";

export function CandidatosGrid({ candidatos }: { candidatos: CandidatoClient[] }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [disponibilidade, setDisponibilidade] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return candidatos.filter((c) => {
      if (termo) {
        const alvo = `${c.nome} ${c.cargoAtual ?? ""} ${c.empresaAtual ?? ""} ${c.cidade ?? ""} ${c.skills.join(" ")} ${c.tecnologias.join(" ")}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      if (disponibilidade && c.disponibilidade !== disponibilidade) return false;
      return true;
    });
  }, [candidatos, busca, disponibilidade]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="w-64 pl-8"
              placeholder="Nome, cargo, empresa, cidade, skill…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select
            items={{ [TODOS]: "Toda disponibilidade", ...disponibilidadeLabel }}
            value={disponibilidade || TODOS}
            onValueChange={(v) => setDisponibilidade(!v || v === TODOS ? "" : v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Disponibilidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Toda disponibilidade</SelectItem>
              {disponibilidadeValues.map((v) => (
                <SelectItem key={v} value={v}>
                  {disponibilidadeLabel[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setNovoAberto(true)}>
          <Plus />
          Novo candidato
        </Button>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum candidato encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => (
            <CandidatoCard key={c.id} candidato={c} />
          ))}
        </div>
      )}

      <NovoCandidatoDialog
        open={novoAberto}
        onOpenChange={setNovoAberto}
        onCriado={(id) => router.push(`/candidatos/${id}`)}
      />
    </div>
  );
}
