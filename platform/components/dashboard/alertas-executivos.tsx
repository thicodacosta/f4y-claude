import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export type AlertaVaga = { id: string; cargo: string; empresaNome: string; diasAberta: number };

export function AlertasExecutivos({
  semSourcing,
  semFecharHaMuitoTempo,
}: {
  semSourcing: AlertaVaga[];
  semFecharHaMuitoTempo: AlertaVaga[];
}) {
  const total = semSourcing.length + semFecharHaMuitoTempo.length;

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum gargalo identificado no momento. 🎉</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {semSourcing.map((v) => (
        <Alerta
          key={v.id}
          vaga={v}
          mensagem={`Aberta há ${v.diasAberta} dias sem nenhum candidato no pipeline.`}
        />
      ))}
      {semFecharHaMuitoTempo.map((v) => (
        <Alerta
          key={v.id}
          vaga={v}
          mensagem={`Aberta há ${v.diasAberta} dias sem preencher todas as posições.`}
        />
      ))}
    </div>
  );
}

function Alerta({ vaga, mensagem }: { vaga: AlertaVaga; mensagem: string }) {
  return (
    <Link
      href={`/vagas/${vaga.id}`}
      className="flex items-start gap-2 rounded-md border border-border p-3 text-sm hover:bg-muted/50"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
      <div className="flex flex-col">
        <span className="font-medium">
          {vaga.cargo} · {vaga.empresaNome}
        </span>
        <span className="text-xs text-muted-foreground">{mensagem}</span>
      </div>
    </Link>
  );
}
