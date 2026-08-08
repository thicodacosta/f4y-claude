"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Briefcase, Loader2, Paperclip } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { criarAtividade, listarAtividades, listarArquivos } from "@/modules/crm/actions";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import type { OportunidadeClient, PipelineEtapaClient } from "@/modules/crm/serialize";
import { criarVagaAPartirDeOportunidade } from "@/modules/ats/actions";

type Atividade = {
  id: string;
  tipo: string;
  conteudo: string;
  criadoEm: Date | string;
  autor: { nome: string } | null;
};

type Arquivo = { id: string; nome: string; url: string; criadoEm: Date | string };

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const TIPOS_MANUAIS = new Set(["nota", "email", "whatsapp", "ligacao", "reuniao", "tarefa"]);

export function OportunidadeDrawer({
  oportunidade,
  onOpenChange,
  consultores,
  etapas,
}: {
  oportunidade: OportunidadeClient | null;
  onOpenChange: (open: boolean) => void;
  consultores: { id: string; nome: string }[];
  etapas: PipelineEtapaClient[];
}) {
  const router = useRouter();
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [criandoVaga, startCriarVaga] = useTransition();
  // "Carregando" é derivado (não um setState síncrono no efeito): compara a
  // oportunidade aberta com a última que teve dados carregados.
  const [carregadoParaId, setCarregadoParaId] = useState<string | null>(null);
  const carregando = !!oportunidade && carregadoParaId !== oportunidade.id;
  const [nota, setNota] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!oportunidade) return;
    let cancelado = false;
    Promise.all([
      listarAtividades("oportunidade", oportunidade.id),
      listarArquivos("oportunidade", oportunidade.id),
    ]).then(([a, f]) => {
      if (cancelado) return;
      setAtividades(a);
      setArquivos(f);
      setCarregadoParaId(oportunidade.id);
    });
    return () => {
      cancelado = true;
    };
  }, [oportunidade]);

  function handleAdicionarNota() {
    if (!oportunidade || !nota.trim()) return;
    const conteudo = nota.trim();
    startTransition(async () => {
      try {
        const criada = await criarAtividade({
          entidadeTipo: "oportunidade",
          entidadeId: oportunidade.id,
          tipo: "nota",
          conteudo,
        });
        setAtividades((prev) => [criada, ...prev]);
        setNota("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível salvar a nota.");
      }
    });
  }

  const manuais = atividades.filter((a) => TIPOS_MANUAIS.has(a.tipo));
  const etapaAtual = oportunidade ? etapas.find((e) => e.id === oportunidade.etapaId) : undefined;

  function handleCriarVaga() {
    if (!oportunidade) return;
    startCriarVaga(async () => {
      try {
        const vaga = await criarVagaAPartirDeOportunidade(oportunidade.id);
        toast.success("Vaga criada — complete os detalhes na tela da vaga.");
        onOpenChange(false);
        router.push(`/vagas/${vaga.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível criar a vaga.");
      }
    });
  }

  return (
    <Sheet open={!!oportunidade} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        {oportunidade && (
          <>
            <SheetHeader>
              <SheetTitle>{oportunidade.empresaNome}</SheetTitle>
              <SheetDescription>
                {verticalNegocioLabel[oportunidade.vertical as keyof typeof verticalNegocioLabel]}
                {oportunidade.executiveSearch && " · Executive Search"} ·{" "}
                {currency.format(oportunidade.valorEstimado)}
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="detalhes" className="flex-1 gap-0 overflow-hidden px-4">
              <TabsList className="w-full">
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="atividades">Atividades</TabsTrigger>
                <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
              </TabsList>

              <TabsContent value="detalhes" className="flex flex-col gap-3 overflow-y-auto py-4 text-sm">
                {etapaAtual?.isGanho && (
                  <Button variant="outline" size="sm" className="self-start" disabled={criandoVaga} onClick={handleCriarVaga}>
                    {criandoVaga ? <Loader2 className="animate-spin" /> : <Briefcase />}
                    Criar vaga a partir desta oportunidade
                  </Button>
                )}
                <Campo label="Contato">{oportunidade.contatoNome ?? "—"}</Campo>
                <Campo label="Responsável">
                  {consultores.find((c) => c.id === oportunidade.responsavelId)?.nome ??
                    oportunidade.responsavelNome ??
                    "—"}
                </Campo>
                <Campo label="Origem">{oportunidade.origem ?? "—"}</Campo>
                <Campo label="Probabilidade">
                  {oportunidade.probabilidade !== null ? `${oportunidade.probabilidade}%` : "—"}
                </Campo>
                <Campo label="Previsão de fechamento">
                  {oportunidade.previsaoFechamento
                    ? new Date(oportunidade.previsaoFechamento).toLocaleDateString("pt-BR")
                    : "—"}
                </Campo>
                {oportunidade.motivoPerda && (
                  <Campo label="Motivo da perda">{oportunidade.motivoPerda}</Campo>
                )}
                <Campo label="Observações">{oportunidade.observacoes ?? "—"}</Campo>
              </TabsContent>

              <TabsContent value="atividades" className="flex flex-col gap-3 overflow-y-auto py-4">
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder="Registrar ligação, reunião, e-mail…"
                    rows={2}
                  />
                  <Button size="sm" className="self-end" disabled={!nota.trim() || isPending} onClick={handleAdicionarNota}>
                    {isPending && <Loader2 className="animate-spin" />}
                    Salvar
                  </Button>
                </div>
                {carregando ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : manuais.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
                ) : (
                  manuais.map((a) => <AtividadeItem key={a.id} atividade={a} />)
                )}
              </TabsContent>

              <TabsContent value="arquivos" className="flex flex-col gap-3 overflow-y-auto py-4">
                {carregando ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : arquivos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum arquivo anexado. Upload de arquivo chega em uma próxima fase.
                  </p>
                ) : (
                  arquivos.map((f) => (
                    <a
                      key={f.id}
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-md border border-border p-2 text-sm hover:bg-muted"
                    >
                      <Paperclip className="size-4 text-muted-foreground" />
                      {f.nome}
                    </a>
                  ))
                )}
              </TabsContent>

              <TabsContent value="historico" className="flex flex-col gap-3 overflow-y-auto py-4">
                {carregando ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : atividades.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>
                ) : (
                  atividades.map((a) => <AtividadeItem key={a.id} atividade={a} />)
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function AtividadeItem({ atividade }: { atividade: Atividade }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-2.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline">{atividade.tipo}</Badge>
        <span className="text-xs text-muted-foreground">
          {dataHora.format(new Date(atividade.criadoEm))}
        </span>
      </div>
      <p>{atividade.conteudo}</p>
      {atividade.autor && (
        <span className="text-xs text-muted-foreground">por {atividade.autor.nome}</span>
      )}
    </div>
  );
}
