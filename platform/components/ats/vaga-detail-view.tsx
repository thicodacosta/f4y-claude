"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CandidatoKanbanView } from "@/components/ats/candidato-kanban-view";
import { EditarVagaDialog } from "@/components/ats/editar-vaga-dialog";
import { AdicionarCandidatoDialog } from "@/components/ats/adicionar-candidato-dialog";
import { MotivoPerdaDialog } from "@/components/crm/motivo-perda-dialog";
import { ContratosTab, type ContratoClient } from "@/components/alocacao/contratos-tab";
import { EmpresasAlvoEditor } from "@/components/executive-search/empresas-alvo-editor";
import { MatchingPanel } from "@/components/ats/matching-panel";
import { moverCandidatoNaVaga, criarAtividadeVaga } from "@/modules/ats/actions";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import { prioridadeVagaLabel, modeloTrabalhoLabel, senioridadeLabel } from "@/modules/ats/schemas";
import type { VagaClient, VagaCandidatoClient } from "@/modules/ats/serialize";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

type Atividade = {
  id: string;
  tipo: string;
  conteudo: string;
  criadoEm: Date | string;
  autor: { nome: string } | null;
};

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  aberta: "default",
  pausada: "secondary",
  fechada: "outline",
  perdida: "destructive",
};

export function VagaDetailView({
  vaga,
  candidatos,
  equipe,
  atividadesIniciais,
  contratos,
}: {
  vaga: VagaClient;
  candidatos: VagaCandidatoClient[];
  equipe: { id: string; nome: string }[];
  atividadesIniciais: Atividade[];
  contratos: ContratoClient[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(candidatos);
  // Resincroniza quando o Server Component pai revalida (ex.: `router.refresh()`
  // após adicionar um candidato) — ajuste durante o render, não em useEffect,
  // mesma técnica de components/crm/pipeline-comercial-view.tsx.
  const [candidatosAnteriores, setCandidatosAnteriores] = useState(candidatos);
  if (candidatos !== candidatosAnteriores) {
    setCandidatosAnteriores(candidatos);
    setItems(candidatos);
  }
  const [editarAberta, setEditarAberta] = useState(false);
  const [adicionarAberta, setAdicionarAberta] = useState(false);
  const [pendingPerda, setPendingPerda] = useState<string | null>(null);
  const [atividades, setAtividades] = useState(atividadesIniciais);
  const [nota, setNota] = useState("");
  const [, startTransition] = useTransition();
  const [isPendingNota, startNota] = useTransition();

  function moverCard(vagaCandidatoId: string, novaEtapa: string, motivoPerda?: string) {
    const anterior = items;
    setItems((prev) => prev.map((vc) => (vc.id === vagaCandidatoId ? { ...vc, etapa: novaEtapa } : vc)));

    startTransition(async () => {
      try {
        await moverCandidatoNaVaga({ vagaCandidatoId, novaEtapa, motivoPerda });
      } catch (err) {
        setItems(anterior);
        toast.error(err instanceof Error ? err.message : "Não foi possível mover o candidato.");
      }
    });
  }

  function handleMove(vagaCandidatoId: string, novaEtapa: string) {
    if (novaEtapa === "perdida") {
      setPendingPerda(vagaCandidatoId);
      return;
    }
    moverCard(vagaCandidatoId, novaEtapa);
  }

  function handleAdicionarNota() {
    if (!nota.trim()) return;
    const conteudo = nota.trim();
    startNota(async () => {
      try {
        const criada = await criarAtividadeVaga({ vagaId: vaga.id, conteudo });
        setAtividades((prev) => [criada, ...prev]);
        setNota("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível salvar a nota.");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push("/vagas")}>
            <ArrowLeft />
            Voltar
          </Button>
          <h1 className="font-heading text-2xl font-bold">
            {vaga.confidencial && "🔒 "}
            {vaga.cargo}
          </h1>
          <p className="text-sm text-muted-foreground">{vaga.empresaNome}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{verticalNegocioLabel[vaga.vertical as keyof typeof verticalNegocioLabel]}</Badge>
          <Badge variant={statusVariant[vaga.status] ?? "outline"}>{vaga.status}</Badge>
          {vaga.confidencial && (
            <Button variant="outline" onClick={() => router.push(`/vagas/${vaga.id}/relatorio`)}>
              Relatório de posição
            </Button>
          )}
          <Button onClick={() => setEditarAberta(true)}>Editar</Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3 overflow-hidden">
          <Tabs defaultValue="candidatos" className="flex flex-1 flex-col gap-3 overflow-hidden">
            <TabsList>
              <TabsTrigger value="candidatos">Candidatos</TabsTrigger>
              <TabsTrigger value="matching">Matching</TabsTrigger>
              <TabsTrigger value="descricao">Descrição</TabsTrigger>
              <TabsTrigger value="atividades">Atividades</TabsTrigger>
              {vaga.vertical === "alocacao_tech" && <TabsTrigger value="contratos">Contratos</TabsTrigger>}
              {vaga.confidencial && <TabsTrigger value="mapeamento">Mapeamento</TabsTrigger>}
            </TabsList>

            <TabsContent value="candidatos" className="flex flex-1 flex-col gap-2 overflow-hidden">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setAdicionarAberta(true)}>
                  <Plus />
                  Adicionar candidato
                </Button>
              </div>
              <CandidatoKanbanView
                items={items}
                onCardClick={(vc) => router.push(`/candidatos/${vc.candidatoId}`)}
                onMove={handleMove}
              />
            </TabsContent>

            <TabsContent value="matching" className="flex flex-col gap-2 overflow-y-auto">
              <MatchingPanel vagaId={vaga.id} />
            </TabsContent>

            <TabsContent value="descricao" className="flex flex-col gap-4 overflow-y-auto text-sm">
              <Campo label="Job Description">
                <p className="whitespace-pre-wrap">{vaga.jobDescription ?? "Nenhuma JD cadastrada ainda."}</p>
              </Campo>
              <Campo label="Stack técnica">
                <div className="flex flex-wrap gap-1.5">
                  {vaga.stackTecnologica.length > 0
                    ? vaga.stackTecnologica.map((s) => <Badge key={s} variant="outline">{s}</Badge>)
                    : "—"}
                </div>
              </Campo>
              <Campo label="Skills requeridas">
                <div className="flex flex-wrap gap-1.5">
                  {vaga.skillsRequeridas.length > 0
                    ? vaga.skillsRequeridas.map((s) => <Badge key={s} variant="outline">{s}</Badge>)
                    : "—"}
                </div>
              </Campo>
            </TabsContent>

            <TabsContent value="atividades" className="flex flex-col gap-3 overflow-y-auto">
              <div className="flex flex-col gap-2">
                <Textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Registrar ligação, nota, atualização…"
                  rows={2}
                />
                <Button size="sm" className="self-end" disabled={!nota.trim() || isPendingNota} onClick={handleAdicionarNota}>
                  {isPendingNota && <Loader2 className="animate-spin" />}
                  Salvar
                </Button>
              </div>
              {atividades.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
              ) : (
                atividades.map((a) => (
                  <div key={a.id} className="flex flex-col gap-1 rounded-md border border-border p-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{a.tipo}</Badge>
                      <span className="text-xs text-muted-foreground">{dataHora.format(new Date(a.criadoEm))}</span>
                    </div>
                    <p>{a.conteudo}</p>
                    {a.autor && <span className="text-xs text-muted-foreground">por {a.autor.nome}</span>}
                  </div>
                ))
              )}
            </TabsContent>

            {vaga.vertical === "alocacao_tech" && (
              <TabsContent value="contratos" className="flex flex-col gap-3 overflow-y-auto">
                <ContratosTab
                  vagaId={vaga.id}
                  contratos={contratos}
                  candidatosDaVaga={items.map((vc) => ({ candidatoId: vc.candidatoId, nome: vc.candidato.nome }))}
                />
              </TabsContent>
            )}

            {vaga.confidencial && (
              <TabsContent value="mapeamento" className="flex flex-col gap-3 overflow-y-auto">
                <EmpresasAlvoEditor vagaId={vaga.id} empresasAlvo={vaga.empresasAlvo} />
              </TabsContent>
            )}
          </Tabs>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto text-sm">
          <Campo label="Empresa">{vaga.empresaNome}</Campo>
          <Campo label="Valor da vaga">{vaga.valor ? currency.format(vaga.valor) : "—"}</Campo>
          <Campo label="Gestor do cliente">{vaga.gestorNome ?? "—"}</Campo>
          <Campo label="Contato do gestor">{vaga.gestorContato ?? "—"}</Campo>
          <Campo label="Salário">
            {vaga.salarioMin || vaga.salarioMax
              ? `${vaga.salarioMin ? currency.format(vaga.salarioMin) : "?"} – ${vaga.salarioMax ? currency.format(vaga.salarioMax) : "?"}`
              : "—"}
          </Campo>
          <Campo label="Benefícios">{vaga.beneficios ?? "—"}</Campo>
          <Campo label="Modelo de trabalho">
            {vaga.modeloTrabalho ? modeloTrabalhoLabel[vaga.modeloTrabalho as keyof typeof modeloTrabalhoLabel] : "—"}
          </Campo>
          <Campo label="Cidade/UF">
            {vaga.cidade ? `${vaga.cidade}${vaga.estado ? "/" + vaga.estado : ""}` : "—"}
          </Campo>
          <Campo label="Senioridade">
            {vaga.senioridade ? senioridadeLabel[vaga.senioridade as keyof typeof senioridadeLabel] : "—"}
          </Campo>
          <Campo label="Prioridade">{prioridadeVagaLabel[vaga.prioridade as keyof typeof prioridadeVagaLabel]}</Campo>
          <Campo label="Posições">
            {vaga.posicoesPreenchidas}/{vaga.quantidadePosicoes}
          </Campo>
          <Campo label="Consultor comercial">{vaga.consultorNome ?? "—"}</Campo>
          <Campo label="Recrutador">{vaga.recrutadorNome ?? "—"}</Campo>
        </div>
      </div>

      <EditarVagaDialog open={editarAberta} onOpenChange={setEditarAberta} vaga={vaga} equipe={equipe} />

      <AdicionarCandidatoDialog
        open={adicionarAberta}
        onOpenChange={setAdicionarAberta}
        vagaId={vaga.id}
        candidatosJaNaVaga={items.map((vc) => vc.candidatoId)}
        onAdicionado={() => router.refresh()}
      />

      <MotivoPerdaDialog
        open={!!pendingPerda}
        onOpenChange={(open) => !open && setPendingPerda(null)}
        onConfirm={(motivo) => {
          if (pendingPerda) moverCard(pendingPerda, "perdida", motivo);
          setPendingPerda(null);
        }}
      />
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border p-2.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
