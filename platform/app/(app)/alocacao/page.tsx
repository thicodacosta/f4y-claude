import Link from "next/link";
import { Users } from "lucide-react";
import { getVagas } from "@/modules/ats/queries";
import { serializeVaga } from "@/modules/ats/serialize";
import { getContratosAtivos } from "@/modules/alocacao/queries";
import { VagasTable } from "@/components/ats/vagas-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
// timeZone UTC: dataFim é @db.Date (sem horário) — ver mesmo comentário em
// components/alocacao/contratos-tab.tsx.
const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

export default async function AlocacaoPage() {
  const [vagas, contratosAtivos] = await Promise.all([getVagas(), getContratosAtivos()]);
  const vagasAlocacao = vagas.filter((v) => v.vertical === "alocacao_tech").map(serializeVaga);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Alocação de Profissionais</h1>
          <p className="text-sm text-muted-foreground">
            Vagas de staffing, contratos e lembrete automático de renovação.
          </p>
        </div>
        <Link href="/alocacao/pool">
          <Button variant="outline">
            <Users />
            Pool de talentos
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-heading text-sm font-semibold">Vagas de alocação</h2>
        <VagasTable vagas={vagasAlocacao} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-heading text-sm font-semibold">Contratos ativos</h2>
        {contratosAtivos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum contrato ativo ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {contratosAtivos.map((c) => (
              <Link
                key={c.id}
                href={`/vagas/${c.vagaId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm hover:bg-muted"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{c.candidato.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.vaga.cargo} · {c.vaga.empresa.nome}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{currency.format(Number(c.rate))}/mês</span>
                  <span>Até {data.format(c.dataFim)}</span>
                  <Badge variant={c.status === "renovado" ? "default" : "secondary"}>{c.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
