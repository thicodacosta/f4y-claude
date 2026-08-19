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
import { statusProximaAcao } from "@/lib/pipeline";
import type { OportunidadeClient, PipelineEtapaClient } from "@/modules/crm/serialize";

export type Filtros = {
  busca: string;
  vertical: string;
  responsavelId: string;
  etapaId: string;
  empresaId: string;
  origem: string;
  proximaAcao: "" | "atrasada" | "hoje" | "agendada" | "sem_acao";
};

export const FILTROS_VAZIOS: Filtros = {
  busca: "",
  vertical: "",
  responsavelId: "",
  etapaId: "",
  empresaId: "",
  origem: "",
  proximaAcao: "",
};

const TODOS = "__todos__";

const proximaAcaoLabel: Record<string, string> = {
  [TODOS]: "Qualquer próxima ação",
  atrasada: "🔴 Atrasada",
  hoje: "🟡 Hoje",
  agendada: "🟢 Agendada",
  sem_acao: "Sem próxima ação",
};

export function FiltrosBar({
  filtros,
  onChange,
  consultores,
  etapas,
  empresas,
}: {
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
  consultores: { id: string; nome: string }[];
  etapas: PipelineEtapaClient[];
  empresas: { id: string; nome: string }[];
}) {
  const temFiltroAtivo = JSON.stringify(filtros) !== JSON.stringify(FILTROS_VAZIOS);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Buscar empresa, contato ou origem…"
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
          [TODOS]: "Todas as etapas",
          ...Object.fromEntries(etapas.map((e) => [e.id, e.nome])),
        }}
        value={filtros.etapaId || TODOS}
        onValueChange={(v) => onChange({ ...filtros, etapaId: !v || v === TODOS ? "" : v })}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Etapa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todas as etapas</SelectItem>
          {etapas.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={{
          [TODOS]: "Todas as empresas",
          ...Object.fromEntries(empresas.map((e) => [e.id, e.nome])),
        }}
        value={filtros.empresaId || TODOS}
        onValueChange={(v) => onChange({ ...filtros, empresaId: !v || v === TODOS ? "" : v })}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Empresa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todas as empresas</SelectItem>
          {empresas.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.nome}
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
      <Select
        items={proximaAcaoLabel}
        value={filtros.proximaAcao || TODOS}
        onValueChange={(v) => onChange({ ...filtros, proximaAcao: (!v || v === TODOS ? "" : v) as Filtros["proximaAcao"] })}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Próxima ação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>{proximaAcaoLabel[TODOS]}</SelectItem>
          <SelectItem value="atrasada">{proximaAcaoLabel.atrasada}</SelectItem>
          <SelectItem value="hoje">{proximaAcaoLabel.hoje}</SelectItem>
          <SelectItem value="agendada">{proximaAcaoLabel.agendada}</SelectItem>
          <SelectItem value="sem_acao">{proximaAcaoLabel.sem_acao}</SelectItem>
        </SelectContent>
      </Select>
      {temFiltroAtivo && (
        <button
          type="button"
          onClick={() => onChange(FILTROS_VAZIOS)}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}

export function aplicarFiltros(items: OportunidadeClient[], filtros: Filtros): OportunidadeClient[] {
  const busca = filtros.busca.trim().toLowerCase();

  return items.filter((o) => {
    if (
      busca &&
      !o.empresaNome.toLowerCase().includes(busca) &&
      !o.contatoNome?.toLowerCase().includes(busca) &&
      !o.origem?.toLowerCase().includes(busca)
    ) {
      return false;
    }
    if (filtros.vertical && o.vertical !== filtros.vertical) return false;
    if (filtros.responsavelId && o.responsavelId !== filtros.responsavelId) return false;
    if (filtros.etapaId && o.etapaId !== filtros.etapaId) return false;
    if (filtros.empresaId && o.empresaId !== filtros.empresaId) return false;
    if (filtros.proximaAcao) {
      if (filtros.proximaAcao === "sem_acao") {
        if (o.proximaAcaoData) return false;
      } else {
        const status = statusProximaAcao(o.proximaAcaoData);
        if (status?.chave !== filtros.proximaAcao) return false;
      }
    }
    return true;
  });
}
