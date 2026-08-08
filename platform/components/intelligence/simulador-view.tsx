"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { categoriaMetaLabel } from "@/modules/metas/schemas";
import {
  simularCrescimentoClientes,
  simularAumentoTicket,
  simularAumentoConversao,
  simularPerdaCliente,
  simularNovosRecrutadores,
  calcularPlanejamentoReverso,
  mixPadraoPorReceitaHistorica,
  type CategoriaNegocio,
} from "@/modules/intelligence/simulations";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const currency2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

type TicketPorVertical = Record<CategoriaNegocio, { receita: number; contagem: number; ticketMedio: number | null }> | null;
type ReceitaPorVertical = Record<CategoriaNegocio, number> | null;

function PresetButtons({
  opcoes,
  valor,
  onChange,
  sufixo = "%",
}: {
  opcoes: number[];
  valor: number;
  onChange: (v: number) => void;
  sufixo?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((op) => (
        <button
          key={op}
          onClick={() => onChange(op)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            valor === op ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
          )}
        >
          +{op}
          {sufixo}
        </button>
      ))}
    </div>
  );
}

function ResultBlock({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-3 text-sm">{children}</div>;
}

function ResultLine({ label, value, destaque }: { label: string; value: string; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono tabular-nums", destaque && "font-semibold text-foreground")}>{value}</span>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function SimuladorView({
  receitaMensalAtual,
  clientesAtivos,
  ticketMedioGeral,
  recrutadoresAtivos,
  vagasFechadasPorRecrutadorMes,
  pipelinePonderadoAtual,
  taxaConversaoComercial,
  clientesParaSimularPerda,
  ticketPorVertical,
  receitaPorVertical,
}: {
  receitaMensalAtual: number;
  clientesAtivos: number;
  ticketMedioGeral: number | null;
  recrutadoresAtivos: number;
  vagasFechadasPorRecrutadorMes: number | null;
  pipelinePonderadoAtual: number;
  taxaConversaoComercial: number;
  clientesParaSimularPerda: { nome: string; valor: number }[];
  ticketPorVertical: TicketPorVertical;
  receitaPorVertical: ReceitaPorVertical;
}) {
  // What-If: crescimento de clientes
  const [pctClientes, setPctClientes] = useState(20);
  const resultadoClientes = useMemo(
    () => simularCrescimentoClientes({ receitaMensalAtual, clientesAtivos, ticketMedioGeral }, pctClientes),
    [receitaMensalAtual, clientesAtivos, ticketMedioGeral, pctClientes],
  );

  // What-If: ticket médio
  const [pctTicket, setPctTicket] = useState(10);
  const resultadoTicket = useMemo(() => simularAumentoTicket(receitaMensalAtual, pctTicket), [receitaMensalAtual, pctTicket]);

  // What-If: conversão
  const [pontosConversao, setPontosConversao] = useState(5);
  const resultadoConversao = useMemo(
    () => simularAumentoConversao(pipelinePonderadoAtual, taxaConversaoComercial || null, pontosConversao),
    [pipelinePonderadoAtual, taxaConversaoComercial, pontosConversao],
  );

  // What-If: perda de cliente
  const [clienteSelecionado, setClienteSelecionado] = useState(clientesParaSimularPerda[0]?.nome ?? "");
  const resultadoPerda = useMemo(() => {
    const cliente = clientesParaSimularPerda.find((c) => c.nome === clienteSelecionado);
    if (!cliente) return null;
    return simularPerdaCliente(receitaMensalAtual, cliente.valor);
  }, [clientesParaSimularPerda, clienteSelecionado, receitaMensalAtual]);

  // What-If: novos recrutadores
  const [novosRecrutadores, setNovosRecrutadores] = useState(1);
  const resultadoRecrutadores = useMemo(
    () => simularNovosRecrutadores(vagasFechadasPorRecrutadorMes, recrutadoresAtivos, novosRecrutadores),
    [vagasFechadasPorRecrutadorMes, recrutadoresAtivos, novosRecrutadores],
  );

  // Reverse Planning
  const [objetivo, setObjetivo] = useState("200000");
  const objetivoNumero = Number(objetivo) || 0;
  const mix = useMemo(() => mixPadraoPorReceitaHistorica(receitaPorVertical), [receitaPorVertical]);
  const ticketMedios = useMemo(
    () => ({
      alocacao: ticketPorVertical?.alocacao.ticketMedio ?? null,
      recrutamento: ticketPorVertical?.recrutamento.ticketMedio ?? null,
      executive_search: ticketPorVertical?.executive_search.ticketMedio ?? null,
    }),
    [ticketPorVertical],
  );
  const planejamento = useMemo(
    () => calcularPlanejamentoReverso(objetivoNumero, ticketMedios, mix),
    [objetivoNumero, ticketMedios, mix],
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Reverse Planning</h2>
        <Card title="Quero faturar por mês" subtitle="Distribuição proporcional à receita histórica de cada vertical.">
          <div className="flex flex-col gap-2">
            <Label htmlFor="objetivo">Objetivo mensal (R$)</Label>
            <Input id="objetivo" type="number" min={0} step="1000" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className="w-48" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(Object.keys(planejamento) as CategoriaNegocio[]).map((categoria) => {
              const item = planejamento[categoria];
              return (
                <ResultBlock key={categoria}>
                  <span className="text-xs font-medium text-muted-foreground">{categoriaMetaLabel[categoria]}</span>
                  <ResultLine label="Meta da vertical" value={currency.format(item.valorAlvo)} />
                  <ResultLine label="Ticket médio real" value={item.ticketMedio != null ? currency2.format(item.ticketMedio) : "Sem dados"} />
                  <ResultLine
                    label="Necessário"
                    value={item.quantidadeNecessaria != null ? `${item.quantidadeNecessaria} fechamento(s)` : "Dados insuficientes"}
                    destaque
                  />
                </ResultBlock>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">What-If</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Se aumentarmos o número de clientes" subtitle={`Base: ${clientesAtivos} clientes ativos`}>
            <PresetButtons opcoes={[10, 20, 30, 50]} valor={pctClientes} onChange={setPctClientes} />
            {resultadoClientes ? (
              <ResultBlock>
                <ResultLine label="Novos clientes" value={String(resultadoClientes.novosClientes)} />
                <ResultLine label="Receita adicional" value={currency.format(resultadoClientes.receitaAdicional)} />
                <ResultLine label="Receita projetada" value={currency.format(resultadoClientes.receitaProjetada)} destaque />
              </ResultBlock>
            ) : (
              <p className="text-sm text-muted-foreground">Dados insuficientes — sem ticket médio ou clientes ativos.</p>
            )}
          </Card>

          <Card title="Se aumentarmos o ticket médio" subtitle={`Base: ${currency.format(receitaMensalAtual)}/mês`}>
            <PresetButtons opcoes={[10, 20]} valor={pctTicket} onChange={setPctTicket} />
            <ResultBlock>
              <ResultLine label="Receita adicional" value={currency.format(resultadoTicket.receitaAdicional)} />
              <ResultLine label="Receita projetada" value={currency.format(resultadoTicket.receitaProjetada)} destaque />
            </ResultBlock>
          </Card>

          <Card title="Se a conversão comercial aumentar" subtitle={`Base: ${taxaConversaoComercial.toFixed(1)}% de conversão`}>
            <PresetButtons opcoes={[5, 10, 15]} valor={pontosConversao} onChange={setPontosConversao} />
            {resultadoConversao ? (
              <ResultBlock>
                <ResultLine label="Nova taxa" value={`${resultadoConversao.novaTaxa.toFixed(1)}%`} />
                <ResultLine label="Pipeline ponderado projetado" value={currency.format(resultadoConversao.pipelinePonderadoProjetado)} destaque />
              </ResultBlock>
            ) : (
              <p className="text-sm text-muted-foreground">Dados insuficientes — sem histórico de conversão comercial.</p>
            )}
          </Card>

          <Card title="Se perdermos um cliente" subtitle="Impacto na receita mensal atual">
            {clientesParaSimularPerda.length === 0 ? (
              <p className="text-sm text-muted-foreground">Dados insuficientes — nenhum cliente com faturamento ainda.</p>
            ) : (
              <>
                <Select items={Object.fromEntries(clientesParaSimularPerda.map((c) => [c.nome, c.nome]))} value={clienteSelecionado} onValueChange={(v) => v && setClienteSelecionado(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientesParaSimularPerda.map((c) => (
                      <SelectItem key={c.nome} value={c.nome}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {resultadoPerda && (
                  <ResultBlock>
                    <ResultLine label="Impacto na receita" value={`-${resultadoPerda.impactoPercentual.toFixed(0)}%`} destaque />
                    <ResultLine label="Receita restante" value={currency.format(resultadoPerda.receitaRestante)} />
                  </ResultBlock>
                )}
              </>
            )}
          </Card>

          <Card title="Se contratarmos mais recrutadores" subtitle={`Base: ${recrutadoresAtivos} recrutador(es) ativo(s)`}>
            <PresetButtons opcoes={[1, 2, 5]} valor={novosRecrutadores} onChange={setNovosRecrutadores} sufixo=" recrutador(es)" />
            {resultadoRecrutadores ? (
              <ResultBlock>
                <ResultLine label="Capacidade atual" value={`${resultadoRecrutadores.capacidadeAtual.toFixed(1)} vagas/mês`} />
                <ResultLine label="Capacidade adicional" value={`+${resultadoRecrutadores.capacidadeAdicional.toFixed(1)} vagas/mês`} destaque />
              </ResultBlock>
            ) : (
              <p className="text-sm text-muted-foreground">Dados insuficientes — sem histórico de vagas fechadas por recrutador.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
