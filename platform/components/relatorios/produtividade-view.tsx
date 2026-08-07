import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HeatmapAtividade, type HeatmapCelula } from "@/components/dashboard/heatmap-atividade";
import { metaTipoLabel, type metaTipoValues } from "@/modules/metas/schemas";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Consultor = {
  usuarioId: string;
  usuarioNome: string;
  oportunidadesGanhas: number;
  valorGanho: number;
  oportunidadesEmAberto: number;
  atividadesRegistradas: number;
};

type Recrutador = {
  usuarioId: string;
  usuarioNome: string;
  vagasFechadas: number;
  vagasEmAberto: number;
  atividadesRegistradas: number;
};

type MetaLinha = {
  id: string;
  usuarioNome: string;
  tipo: string;
  valorAlvo: number;
  valorAtual: number;
  percentual: number;
};

function Secao({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="font-heading text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

export function ProdutividadeView({
  consultores,
  recrutadores,
  heatmap,
  metas,
  ano,
  mes,
}: {
  consultores: Consultor[];
  recrutadores: Recrutador[];
  heatmap: HeatmapCelula[];
  metas: MetaLinha[];
  ano: number;
  mes: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Secao title="Produtividade — Comercial">
        {consultores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum consultor cadastrado.</p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Ganhas no mês</TableHead>
                  <TableHead>Valor ganho</TableHead>
                  <TableHead>Em aberto</TableHead>
                  <TableHead>Atividades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultores.map((c) => (
                  <TableRow key={c.usuarioId}>
                    <TableCell className="font-medium">{c.usuarioNome}</TableCell>
                    <TableCell className="tabular-nums">{c.oportunidadesGanhas}</TableCell>
                    <TableCell className="tabular-nums">{currency.format(c.valorGanho)}</TableCell>
                    <TableCell className="tabular-nums">{c.oportunidadesEmAberto}</TableCell>
                    <TableCell className="tabular-nums">{c.atividadesRegistradas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Secao>

      <Secao title="Produtividade — Recrutamento">
        {recrutadores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum recrutador cadastrado.</p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recrutador</TableHead>
                  <TableHead>Vagas fechadas</TableHead>
                  <TableHead>Em aberto</TableHead>
                  <TableHead>Atividades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recrutadores.map((r) => (
                  <TableRow key={r.usuarioId}>
                    <TableCell className="font-medium">{r.usuarioNome}</TableCell>
                    <TableCell className="tabular-nums">{r.vagasFechadas}</TableCell>
                    <TableCell className="tabular-nums">{r.vagasEmAberto}</TableCell>
                    <TableCell className="tabular-nums">{r.atividadesRegistradas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Secao>

      <Secao title="Heatmap de atividade">
        <HeatmapAtividade celulas={heatmap} ano={ano} mes={mes} />
      </Secao>

      <Secao title="Leaderboard de metas">
        {metas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma meta definida este mês.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {metas.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border border-border p-2.5 text-sm">
                <span>
                  {m.usuarioNome} · {metaTipoLabel[m.tipo as (typeof metaTipoValues)[number]]}
                </span>
                <Badge variant={m.percentual >= 100 ? "default" : "secondary"}>{m.percentual}%</Badge>
              </div>
            ))}
          </div>
        )}
      </Secao>
    </div>
  );
}
