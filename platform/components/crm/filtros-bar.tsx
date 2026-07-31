"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { verticalNegocioValues, verticalNegocioLabel } from "@/modules/crm/schemas";

export type Filtros = {
  busca: string;
  vertical: string;
  responsavelId: string;
};

const TODOS = "__todos__";

export function FiltrosBar({
  filtros,
  onChange,
  consultores,
}: {
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
  consultores: { id: string; nome: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Buscar empresa ou contato…"
        value={filtros.busca}
        onChange={(e) => onChange({ ...filtros, busca: e.target.value })}
        className="w-56"
      />
      <Select
        items={{ [TODOS]: "Todas as verticais", ...verticalNegocioLabel }}
        value={filtros.vertical || TODOS}
        onValueChange={(v) => onChange({ ...filtros, vertical: !v || v === TODOS ? "" : v })}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Vertical" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todas as verticais</SelectItem>
          {verticalNegocioValues.map((v) => (
            <SelectItem key={v} value={v}>
              {verticalNegocioLabel[v]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={{
          [TODOS]: "Todos os responsáveis",
          ...Object.fromEntries(consultores.map((c) => [c.id, c.nome])),
        }}
        value={filtros.responsavelId || TODOS}
        onValueChange={(v) => onChange({ ...filtros, responsavelId: !v || v === TODOS ? "" : v })}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os responsáveis</SelectItem>
          {consultores.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function aplicarFiltros<T extends { empresaNome: string; contatoNome: string | null; vertical: string; responsavelId: string | null }>(
  items: T[],
  filtros: Filtros,
): T[] {
  const busca = filtros.busca.trim().toLowerCase();
  return items.filter((o) => {
    if (busca && !o.empresaNome.toLowerCase().includes(busca) && !o.contatoNome?.toLowerCase().includes(busca)) {
      return false;
    }
    if (filtros.vertical && o.vertical !== filtros.vertical) return false;
    if (filtros.responsavelId && o.responsavelId !== filtros.responsavelId) return false;
    return true;
  });
}
