"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContatoCard } from "@/components/crm/contato-card";
import { areaContatoLabel, tipoContatoLabel } from "@/modules/crm/schemas";
import type { ContatoClient } from "@/modules/crm/serialize";

const TODOS = "__todos__";
const SEM_EMPRESA = "__sem_empresa__";

export function ContatosView({ contatos }: { contatos: ContatoClient[] }) {
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState("");
  const [tipo, setTipo] = useState("");
  const [empresa, setEmpresa] = useState("");

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
      return true;
    });
  }, [contatos, busca, area, tipo, empresa]);

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
