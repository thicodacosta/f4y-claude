"use client";

import { Fragment, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atualizarStatusFaturamento, marcarNfEmitida, marcarAlocacaoEncerrada } from "@/modules/financeiro/actions";
import { statusFaturamentoLabel, proximoStatusFaturamento } from "@/modules/financeiro/schemas";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  pendente: "secondary",
  faturado: "default",
  pago: "outline",
};

type Faturamento = {
  id: string;
  empresaNome: string;
  origem: string;
  valor: number;
  status: string;
  dataPrevista: string | null;
  dataEfetiva: string | null;
  dataInicio: string | null;
  contatosNf: string[];
  dataEmissaoNf: string | null;
  nfEmitida: boolean;
  dataInicioProfissional: string | null;
  dataTerminoAlocacao: string | null;
  alocacaoEncerrada: boolean;
};

export function FaturamentoTable({ faturamentos }: { faturamentos: Faturamento[] }) {
  const [expandido, setExpandido] = useState<string | null>(null);

  if (faturamentos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum faturamento ainda.</p>;
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data prevista</TableHead>
            <TableHead>Data efetiva</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {faturamentos.map((f) => {
            const proximo = proximoStatusFaturamento[f.status as keyof typeof proximoStatusFaturamento];
            const temFechamento = !!f.dataInicio;
            const aberta = expandido === f.id;
            return (
              <Fragment key={f.id}>
                <TableRow>
                  <TableCell className="font-medium">
                    {temFechamento && (
                      <button
                        type="button"
                        onClick={() => setExpandido(aberta ? null : f.id)}
                        className="mr-1 inline-flex align-middle text-muted-foreground hover:text-foreground"
                        aria-label="Detalhes do fechamento"
                      >
                        <ChevronRight className={aberta ? "size-3.5 rotate-90 transition-transform" : "size-3.5 transition-transform"} />
                      </button>
                    )}
                    {f.empresaNome}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.origem}</TableCell>
                  <TableCell className="font-mono tabular-nums">{currency.format(f.valor)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[f.status] ?? "outline"}>
                      {statusFaturamentoLabel[f.status as keyof typeof statusFaturamentoLabel]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {f.dataPrevista ? data.format(new Date(f.dataPrevista)) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {f.dataEfetiva ? data.format(new Date(f.dataEfetiva)) : "—"}
                  </TableCell>
                  <TableCell>
                    {proximo && (
                      <StatusButton
                        label={`Marcar ${statusFaturamentoLabel[proximo].toLowerCase()}`}
                        onClick={async () => {
                          try {
                            await atualizarStatusFaturamento({ faturamentoId: f.id, novoStatus: proximo });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Não foi possível atualizar.");
                          }
                        }}
                      />
                    )}
                  </TableCell>
                </TableRow>
                {temFechamento && aberta && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/40">
                      <div className="flex flex-wrap gap-6 py-1 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Data de início</p>
                          <p>{f.dataInicio ? data.format(new Date(f.dataInicio)) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Contato(s) NF</p>
                          <p>{f.contatosNf.length > 0 ? f.contatosNf.join(", ") : "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Emissão da NF</p>
                          <div className="flex items-center gap-2">
                            <p>{f.dataEmissaoNf ? data.format(new Date(f.dataEmissaoNf)) : "—"}</p>
                            {f.dataEmissaoNf && (
                              <Badge variant={f.nfEmitida ? "outline" : "secondary"}>
                                {f.nfEmitida ? "Emitida" : "Pendente"}
                              </Badge>
                            )}
                            {f.dataEmissaoNf && !f.nfEmitida && (
                              <StatusButton
                                label="Marcar emitida"
                                onClick={async () => {
                                  try {
                                    await marcarNfEmitida({ faturamentoId: f.id });
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Não foi possível atualizar.");
                                  }
                                }}
                              />
                            )}
                          </div>
                        </div>
                        {f.dataInicioProfissional && (
                          <div>
                            <p className="text-xs text-muted-foreground">Início do profissional</p>
                            <p>{data.format(new Date(f.dataInicioProfissional))}</p>
                          </div>
                        )}
                        {f.dataTerminoAlocacao && (
                          <div>
                            <p className="text-xs text-muted-foreground">Término da alocação</p>
                            <div className="flex items-center gap-2">
                              <p>{data.format(new Date(f.dataTerminoAlocacao))}</p>
                              <Badge variant={f.alocacaoEncerrada ? "outline" : "secondary"}>
                                {f.alocacaoEncerrada ? "Encerrada" : "Ativa"}
                              </Badge>
                              {!f.alocacaoEncerrada && (
                                <StatusButton
                                  label="Marcar encerrada"
                                  onClick={async () => {
                                    try {
                                      await marcarAlocacaoEncerrada({ faturamentoId: f.id });
                                    } catch (err) {
                                      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar.");
                                    }
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusButton({ label, onClick }: { label: string; onClick: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => startTransition(onClick)}
    >
      {isPending && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );
}
