"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContatoCard } from "@/components/crm/contato-card";
import { areaContatoLabel, tipoContatoLabel } from "@/modules/crm/schemas";
import type { ContatoClient } from "@/modules/crm/serialize";

const TODOS = "__todos__";
const SEM_EMPRESA = "__sem_empresa__";

/** Perfil de atendimento — deriva de área/nível já existentes, sem campo
 * novo no banco. Recrutamento & Seleção fala com RH e também direto com
 * C-Level (CEO/C-suite decide contratação executiva mesmo fora de RH);
 * Alocação Tech fala com o time técnico, então é a área Tecnologia que
 * sobra fora desse recorte. Contato sem área nem nível C-Level fica sem
 * perfil (só aparece em "Todos"). */
const perfilLabel = {
  recrutamento: "Recrutamento (RH e C-Level)",
  alocacao: "Alocação (TI)",
} as const;

function perfilDoContato(c: ContatoClient): keyof typeof perfilLabel | null {
  if (c.area === "rh" || c.nivel === "c_level") return "recrutamento";
  if (c.area === "tecnologia") return "alocacao";
  return null;
}

export function ContatosView({ contatos }: { contatos: ContatoClient[] }) {
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState("");
  const [tipo, setTipo] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [perfil, setPerfil] = useState("");

  const empresas = useMemo(() => {
    const nomes = new Set(contatos.map((c) => c.empresaNome).filter((n): n is string => !!n));
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [contatos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contatos.filter((c) => {
      if (termo && !c.nome.toLowerCase().includes(termo) && !c.empresaNome?.toLowerCase().includes(termo)) return false;
      if (area && c.area !== area) return false;
      if (tipo && c.tipo !== tipo) return false;
      if (empresa === SEM_EMPRESA && c.empresaNome) return false;
      if (empresa && empresa !== SEM_EMPRESA && c.empresaNome !== empresa) return false;
      if (perfil && perfilDoContato(c) !== perfil) return false;
      return true;
    });
  }, [contatos, busca, area, tipo, empresa, perfil]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar nome ou empresa…" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-56" />
        <Select items={{ [TODOS]: "Todas as áreas", ...areaContatoLabel }} value={area || TODOS} onValueChange={(v) => setArea(!v || v === TODOS ? "" : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as áreas</SelectItem>
            {Object.entries(areaContatoLabel).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={{ [TODOS]: "Todos os tipos", ...tipoContatoLabel }} value={tipo || TODOS} onValueChange={(v) => setTipo(!v || v === TODOS ? "" : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os tipos</SelectItem>
            {Object.entries(tipoContatoLabel).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={{ [TODOS]: "Todas as empresas", [SEM_EMPRESA]: "Sem empresa", ...Object.fromEntries(empresas.map((e) => [e, e])) }}
          value={empresa || TODOS}
          onValueChange={(v) => setEmpresa(!v || v === TODOS ? "" : v)}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as empresas</SelectItem>
            <SelectItem value={SEM_EMPRESA}>Sem empresa</SelectItem>
            {empresas.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={{ [TODOS]: "Todos os perfis", ...perfilLabel }} value={perfil || TODOS} onValueChange={(v) => setPerfil(!v || v === TODOS ? "" : v)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Perfil de atendimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os perfis</SelectItem>
            {Object.entries(perfilLabel).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtrados.length} contato(s)</span>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum contato encontrado com esses filtros.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => (
            <ContatoCard key={c.id} contato={c} />
          ))}
        </div>
      )}
    </div>
  );
}
