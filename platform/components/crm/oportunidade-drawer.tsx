"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Briefcase,
  Loader2,
  Paperclip,
  Trash2,
  ExternalLink,
  Mail,
  Phone,
  Link2,
  MessageCircle,
  Building2,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  criarAtividade,
  listarAtividades,
  listarArquivos,
  atualizarOportunidade,
  uploadDocumento,
  excluirDocumento,
} from "@/modules/crm/actions";
import {
  verticalNegocioLabel,
  resultadoReuniaoValues,
  resultadoReuniaoLabel,
  motivoNegociacaoPresetValues,
  documentoCategoriaLabel,
  type AtualizarOportunidadeFormInput,
} from "@/modules/crm/schemas";
import type { OportunidadeClient, PipelineEtapaClient, ContatoClient } from "@/modules/crm/serialize";
import { criarVagaAPartirDeOportunidade } from "@/modules/ats/actions";
import { waLink } from "@/lib/whatsapp";

type Atividade = {
  id: string;
  tipo: string;
  conteudo: string;
  criadoEm: Date | string;
  autor: { nome: string } | null;
};

type Arquivo = {
  id: string;
  nome: string;
  categoria: string | null;
  versao: number;
  valorProposta: number | null;
  statusProposta: string | null;
  criadoEm: Date | string;
  enviadoPorNome: string | null;
  urlAssinada: string | null;
};

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const TIPOS_MANUAIS = new Set(["nota", "email", "whatsapp", "ligacao", "reuniao", "tarefa"]);
const OUTRO_MOTIVO = "__outro__";

export function OportunidadeDrawer({
  oportunidade,
  onOpenChange,
  consultores,
  etapas,
  contatos,
}: {
  oportunidade: OportunidadeClient | null;
  onOpenChange: (open: boolean) => void;
  consultores: { id: string; nome: string }[];
  etapas: PipelineEtapaClient[];
  contatos: ContatoClient[];
}) {
  const router = useRouter();
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [criandoVaga, startCriarVaga] = useTransition();
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

  function recarregarArquivos() {
    if (!oportunidade) return;
    listarArquivos("oportunidade", oportunidade.id).then(setArquivos);
  }

  function registrarAtividadeLocal() {
    if (!oportunidade) return;
    listarAtividades("oportunidade", oportunidade.id).then(setAtividades);
  }

  const manuais = atividades.filter((a) => TIPOS_MANUAIS.has(a.tipo));
  const etapaAtual = oportunidade ? etapas.find((e) => e.id === oportunidade.etapaId) : undefined;
  const propostas = arquivos.filter((a) => a.categoria === "proposta");
  const documentos = arquivos.filter((a) => a.categoria === "contrato" || a.categoria === "outro");

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
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {oportunidade && (
          <>
            <SheetHeader>
              <SheetTitle>{oportunidade.empresaNome}</SheetTitle>
              <SheetDescription>
                {verticalNegocioLabel[oportunidade.vertical as keyof typeof verticalNegocioLabel]}
                {oportunidade.executiveSearch && " · Executive Search"} ·{" "}
                {currency.format(oportunidade.valorEstimado)}
                {etapaAtual && ` · ${etapaAtual.nome}`}
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="resumo" className="flex-1 gap-0 overflow-hidden px-4">
              <TabsList className="w-full flex-wrap">
                <TabsTrigger value="resumo">Resumo</TabsTrigger>
                <TabsTrigger value="empresa">Empresa</TabsTrigger>
                <TabsTrigger value="contato">Contato</TabsTrigger>
                <TabsTrigger value="atividades">Atividades</TabsTrigger>
                <TabsTrigger value="propostas">Propostas</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                <TabsTrigger value="negociacao">Negociação</TabsTrigger>
                <TabsTrigger value="observacoes">Observações</TabsTrigger>
              </TabsList>

              <TabsContent value="resumo" className="flex flex-col gap-4 overflow-y-auto py-4 text-sm">
                {etapaAtual?.isGanho && (
                  <Button variant="outline" size="sm" className="self-start" disabled={criandoVaga} onClick={handleCriarVaga}>
                    {criandoVaga ? <Loader2 className="animate-spin" /> : <Briefcase />}
                    Criar vaga a partir desta oportunidade
                  </Button>
                )}
                <ResumoForm
                  key={oportunidade.id}
                  oportunidade={oportunidade}
                  consultores={consultores}
                  onSalvar={registrarAtividadeLocal}
                />
              </TabsContent>

              <TabsContent value="empresa" className="flex flex-col gap-3 overflow-y-auto py-4 text-sm">
                <Campo label="Empresa">{oportunidade.empresaNome}</Campo>
                <Campo label="Segmento">{oportunidade.empresaSegmento ?? "—"}</Campo>
                <Campo label="Porte">{oportunidade.empresaPorte ?? "—"}</Campo>
                <Campo label="Localização">
                  {oportunidade.empresaCidade || oportunidade.empresaEstado
                    ? [oportunidade.empresaCidade, oportunidade.empresaEstado].filter(Boolean).join(" / ")
                    : "—"}
                </Campo>
                <Campo label="Status">
                  <Badge variant={oportunidade.empresaStatus === "ativo" ? "default" : "secondary"}>
                    {oportunidade.empresaStatus}
                  </Badge>
                </Campo>
                <Link
                  href={`/empresas/${oportunidade.empresaId}`}
                  className="mt-1 flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Building2 className="size-4" />
                  Ver ficha completa da empresa
                  <ExternalLink className="size-3.5" />
                </Link>
              </TabsContent>

              <TabsContent value="contato" className="flex flex-col gap-3 overflow-y-auto py-4 text-sm">
                <ContatoTab
                  key={oportunidade.id}
                  oportunidade={oportunidade}
                  contatos={contatos}
                  onSalvar={registrarAtividadeLocal}
                />
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

                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Linha do tempo completa
                </p>
                {carregando ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : atividades.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>
                ) : (
                  atividades.map((a) => <AtividadeItem key={`hist-${a.id}`} atividade={a} />)
                )}
              </TabsContent>

              <TabsContent value="propostas" className="flex flex-col gap-3 overflow-y-auto py-4">
                <UploadDocumentoForm
                  entidadeId={oportunidade.id}
                  categoriaFixa="proposta"
                  onEnviado={() => {
                    recarregarArquivos();
                    registrarAtividadeLocal();
                  }}
                />
                {carregando ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : propostas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma proposta enviada ainda.</p>
                ) : (
                  propostas.map((f) => <ArquivoItem key={f.id} arquivo={f} onExcluido={recarregarArquivos} />)
                )}
              </TabsContent>

              <TabsContent value="documentos" className="flex flex-col gap-3 overflow-y-auto py-4">
                <UploadDocumentoForm
                  entidadeId={oportunidade.id}
                  onEnviado={() => {
                    recarregarArquivos();
                    registrarAtividadeLocal();
                  }}
                />
                {carregando ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : documentos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum documento anexado ainda.</p>
                ) : (
                  documentos.map((f) => <ArquivoItem key={f.id} arquivo={f} onExcluido={recarregarArquivos} />)
                )}
              </TabsContent>

              <TabsContent value="negociacao" className="flex flex-col gap-4 overflow-y-auto py-4 text-sm">
                <NegociacaoForm
                  key={oportunidade.id}
                  oportunidade={oportunidade}
                  onSalvar={registrarAtividadeLocal}
                />
              </TabsContent>

              <TabsContent value="observacoes" className="flex flex-col gap-4 overflow-y-auto py-4 text-sm">
                {oportunidade.motivoPerda && <Campo label="Motivo da perda">{oportunidade.motivoPerda}</Campo>}
                <ObservacoesForm
                  key={oportunidade.id}
                  oportunidade={oportunidade}
                  onSalvar={registrarAtividadeLocal}
                />
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

// --- Aba Resumo --------------------------------------------------------------

function ResumoForm({
  oportunidade,
  consultores,
  onSalvar,
}: {
  oportunidade: OportunidadeClient;
  consultores: { id: string; nome: string }[];
  onSalvar: () => void;
}) {
  const [form, setForm] = useState({
    proximaAcao: oportunidade.proximaAcao ?? "",
    proximaAcaoData: oportunidade.proximaAcaoData ? oportunidade.proximaAcaoData.slice(0, 10) : "",
    responsavelId: oportunidade.responsavelId ?? "",
    previsaoFechamento: oportunidade.previsaoFechamento ? oportunidade.previsaoFechamento.slice(0, 10) : "",
    probabilidade: oportunidade.probabilidade?.toString() ?? "",
    valorEstimado: oportunidade.valorEstimado.toString(),
  });
  const [isPending, startTransition] = useTransition();
  const SEM_RESPONSAVEL = "__sem__";

  function salvar() {
    startTransition(async () => {
      try {
        const input: AtualizarOportunidadeFormInput = {
          oportunidadeId: oportunidade.id,
          proximaAcao: form.proximaAcao.trim() || null,
          proximaAcaoData: form.proximaAcaoData || null,
          responsavelId: form.responsavelId || null,
          previsaoFechamento: form.previsaoFechamento || null,
          probabilidade: form.probabilidade === "" ? null : Number(form.probabilidade),
          valorEstimado: Number(form.valorEstimado),
        };
        await atualizarOportunidade(input);
        onSalvar();
        toast.success("Resumo atualizado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Próxima ação</Label>
        <Input
          value={form.proximaAcao}
          onChange={(e) => setForm((f) => ({ ...f, proximaAcao: e.target.value }))}
          placeholder="Ex.: Ligar para confirmar reunião"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Data da próxima ação</Label>
          <Input
            type="date"
            value={form.proximaAcaoData}
            onChange={(e) => setForm((f) => ({ ...f, proximaAcaoData: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Previsão de fechamento</Label>
          <Input
            type="date"
            value={form.previsaoFechamento}
            onChange={(e) => setForm((f) => ({ ...f, previsaoFechamento: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Responsável</Label>
        <Select
          items={{ [SEM_RESPONSAVEL]: "Sem responsável", ...Object.fromEntries(consultores.map((c) => [c.id, c.nome])) }}
          value={form.responsavelId || SEM_RESPONSAVEL}
          onValueChange={(v) => setForm((f) => ({ ...f, responsavelId: !v || v === SEM_RESPONSAVEL ? "" : v }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_RESPONSAVEL}>Sem responsável</SelectItem>
            {consultores.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Probabilidade (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.probabilidade}
            onChange={(e) => setForm((f) => ({ ...f, probabilidade: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Valor estimado (R$)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.valorEstimado}
            onChange={(e) => setForm((f) => ({ ...f, valorEstimado: e.target.value }))}
          />
        </div>
      </div>
      <Button size="sm" className="self-end" disabled={isPending} onClick={salvar}>
        {isPending && <Loader2 className="animate-spin" />}
        Salvar
      </Button>
    </div>
  );
}

// --- Aba Contato ---------------------------------------------------------------

function ContatoTab({
  oportunidade,
  contatos,
  onSalvar,
}: {
  oportunidade: OportunidadeClient;
  contatos: ContatoClient[];
  onSalvar: () => void;
}) {
  const [contatoId, setContatoId] = useState(oportunidade.contatoId ?? "");
  const [isPending, startTransition] = useTransition();
  const SEM_CONTATO = "__sem__";

  const daEmpresa = contatos.filter((c) => c.empresaId === oportunidade.empresaId);
  const linkWa = waLink(oportunidade.contatoTelefone);

  function trocarContato(novoId: string) {
    setContatoId(novoId);
    startTransition(async () => {
      try {
        await atualizarOportunidade({ oportunidadeId: oportunidade.id, contatoId: novoId || null });
        onSalvar();
        toast.success("Contato atualizado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível trocar o contato.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Contato principal</Label>
        <Select
          items={{ [SEM_CONTATO]: "Sem contato definido", ...Object.fromEntries(daEmpresa.map((c) => [c.id, c.nome])) }}
          value={contatoId || SEM_CONTATO}
          onValueChange={(v) => trocarContato(!v || v === SEM_CONTATO ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione o contato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_CONTATO}>Sem contato definido</SelectItem>
            {daEmpresa.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isPending && <span className="text-xs text-muted-foreground">Salvando…</span>}
      </div>

      {oportunidade.contatoNome ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <span className="font-medium">{oportunidade.contatoNome}</span>
          {oportunidade.contatoCargo && (
            <span className="text-xs text-muted-foreground">{oportunidade.contatoCargo}</span>
          )}
          {oportunidade.contatoEmail && (
            <a href={`mailto:${oportunidade.contatoEmail}`} className="flex items-center gap-1.5 text-sm hover:underline">
              <Mail className="size-3.5 text-muted-foreground" />
              {oportunidade.contatoEmail}
            </a>
          )}
          {oportunidade.contatoTelefone && (
            <span className="flex items-center gap-1.5 text-sm">
              <Phone className="size-3.5 text-muted-foreground" />
              {oportunidade.contatoTelefone}
              {linkWa && (
                <a href={linkWa} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">
                  <MessageCircle className="size-3.5" />
                </a>
              )}
            </span>
          )}
          {oportunidade.contatoLinkedin && (
            <a
              href={oportunidade.contatoLinkedin}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm hover:underline"
            >
              <Link2 className="size-3.5 text-muted-foreground" />
              LinkedIn
            </a>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum contato vinculado a esta oportunidade.</p>
      )}
    </div>
  );
}

// --- Abas Propostas / Documentos ------------------------------------------------

function UploadDocumentoForm({
  entidadeId,
  categoriaFixa,
  onEnviado,
}: {
  entidadeId: string;
  categoriaFixa?: "contrato" | "outro" | "proposta";
  onEnviado: () => void;
}) {
  const [categoria, setCategoria] = useState<"contrato" | "outro">("contrato");
  const [valorProposta, setValorProposta] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  function enviar() {
    if (!arquivo) {
      toast.error("Selecione um arquivo.");
      return;
    }
    const formData = new FormData();
    formData.set("entidadeTipo", "oportunidade");
    formData.set("entidadeId", entidadeId);
    formData.set("categoria", categoriaFixa ?? categoria);
    if (categoriaFixa === "proposta" && valorProposta) formData.set("valorProposta", valorProposta);
    formData.set("arquivo", arquivo);

    startTransition(async () => {
      try {
        await uploadDocumento(formData);
        toast.success("Arquivo enviado.");
        setArquivo(null);
        setValorProposta("");
        onEnviado();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível enviar o arquivo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
      <Input type="file" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      {categoriaFixa === "proposta" ? (
        <Input
          type="number"
          min={0}
          step="0.01"
          placeholder="Valor da proposta (R$)"
          value={valorProposta}
          onChange={(e) => setValorProposta(e.target.value)}
        />
      ) : (
        <Select items={{ contrato: documentoCategoriaLabel.contrato, outro: documentoCategoriaLabel.outro }} value={categoria} onValueChange={(v) => setCategoria((v as "contrato" | "outro") ?? "contrato")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contrato">{documentoCategoriaLabel.contrato}</SelectItem>
            <SelectItem value="outro">{documentoCategoriaLabel.outro}</SelectItem>
          </SelectContent>
        </Select>
      )}
      <Button size="sm" className="self-end" disabled={isPending || !arquivo} onClick={enviar}>
        {isPending && <Loader2 className="animate-spin" />}
        Enviar
      </Button>
    </div>
  );
}

function ArquivoItem({ arquivo, onExcluido }: { arquivo: Arquivo; onExcluido: () => void }) {
  const [isPending, startTransition] = useTransition();

  function excluir() {
    if (!window.confirm(`Excluir "${arquivo.nome}"? Essa ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      try {
        await excluirDocumento(arquivo.id);
        toast.success("Arquivo removido.");
        onExcluido();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível excluir o arquivo.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5 text-sm">
      <a
        href={arquivo.urlAssinada ?? "#"}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
      >
        <Paperclip className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{arquivo.nome}</span>
        {arquivo.categoria === "proposta" && <Badge variant="secondary">v{arquivo.versao}</Badge>}
      </a>
      <div className="flex shrink-0 items-center gap-2">
        {arquivo.valorProposta != null && (
          <span className="font-mono text-xs text-muted-foreground">{currency.format(arquivo.valorProposta)}</span>
        )}
        <span className="text-xs text-muted-foreground">{dataCurta.format(new Date(arquivo.criadoEm))}</span>
        <Button variant="ghost" size="icon" className="size-6" disabled={isPending} onClick={excluir}>
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// --- Aba Negociação ------------------------------------------------------------

function NegociacaoForm({
  oportunidade,
  onSalvar,
}: {
  oportunidade: OportunidadeClient;
  onSalvar: () => void;
}) {
  const motivoPreset = oportunidade.motivoNegociacao && (motivoNegociacaoPresetValues as readonly string[]).includes(oportunidade.motivoNegociacao)
    ? oportunidade.motivoNegociacao
    : oportunidade.motivoNegociacao
      ? OUTRO_MOTIVO
      : "";
  const [form, setForm] = useState({
    resultadoReuniao: oportunidade.resultadoReuniao ?? "",
    valorNegociado: oportunidade.valorNegociado?.toString() ?? "",
    desconto: oportunidade.desconto?.toString() ?? "",
    motivoPreset,
    motivoOutro: motivoPreset === OUTRO_MOTIVO ? oportunidade.motivoNegociacao ?? "" : "",
    concorrente: oportunidade.concorrente ?? "",
  });
  const [isPending, startTransition] = useTransition();
  const SEM_RESULTADO = "__sem__";

  function salvar() {
    const motivoNegociacao = form.motivoPreset === OUTRO_MOTIVO ? form.motivoOutro.trim() : form.motivoPreset;
    startTransition(async () => {
      try {
        await atualizarOportunidade({
          oportunidadeId: oportunidade.id,
          resultadoReuniao: (form.resultadoReuniao || null) as AtualizarOportunidadeFormInput["resultadoReuniao"],
          valorNegociado: form.valorNegociado === "" ? null : Number(form.valorNegociado),
          desconto: form.desconto === "" ? null : Number(form.desconto),
          motivoNegociacao: motivoNegociacao || null,
          concorrente: form.concorrente.trim() || null,
        });
        onSalvar();
        toast.success("Negociação atualizada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Resultado da reunião</Label>
        <Select
          items={{ [SEM_RESULTADO]: "—", ...resultadoReuniaoLabel }}
          value={form.resultadoReuniao || SEM_RESULTADO}
          onValueChange={(v) => setForm((f) => ({ ...f, resultadoReuniao: !v || v === SEM_RESULTADO ? "" : v }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Resultado da reunião" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_RESULTADO}>—</SelectItem>
            {resultadoReuniaoValues.map((v) => (
              <SelectItem key={v} value={v}>
                {resultadoReuniaoLabel[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Valor negociado (R$)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.valorNegociado}
            onChange={(e) => setForm((f) => ({ ...f, valorNegociado: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Desconto (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.desconto}
            onChange={(e) => setForm((f) => ({ ...f, desconto: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Motivo (objeção principal)</Label>
        <Select
          items={{ __vazio__: "—", ...Object.fromEntries(motivoNegociacaoPresetValues.map((m) => [m, m])) }}
          value={form.motivoPreset || "__vazio__"}
          onValueChange={(v) => setForm((f) => ({ ...f, motivoPreset: !v || v === "__vazio__" ? "" : v }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Motivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__vazio__">—</SelectItem>
            {motivoNegociacaoPresetValues.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.motivoPreset === OUTRO_MOTIVO && (
          <Input
            placeholder="Descreva o motivo"
            value={form.motivoOutro}
            onChange={(e) => setForm((f) => ({ ...f, motivoOutro: e.target.value }))}
          />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Concorrente</Label>
        <Input
          value={form.concorrente}
          onChange={(e) => setForm((f) => ({ ...f, concorrente: e.target.value }))}
          placeholder="Quem mais está disputando esta conta?"
        />
      </div>
      <Button size="sm" className="self-end" disabled={isPending} onClick={salvar}>
        {isPending && <Loader2 className="animate-spin" />}
        Salvar
      </Button>
    </div>
  );
}

// --- Aba Observações -------------------------------------------------------------

function ObservacoesForm({
  oportunidade,
  onSalvar,
}: {
  oportunidade: OportunidadeClient;
  onSalvar: () => void;
}) {
  const [observacoes, setObservacoes] = useState(oportunidade.observacoes ?? "");
  const [isPending, startTransition] = useTransition();

  function salvar() {
    startTransition(async () => {
      try {
        await atualizarOportunidade({ oportunidadeId: oportunidade.id, observacoes: observacoes.trim() || null });
        onSalvar();
        toast.success("Observações salvas.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Observações gerais</Label>
      <Textarea
        rows={8}
        value={observacoes}
        onChange={(e) => setObservacoes(e.target.value)}
        placeholder="Contexto, dores do cliente, histórico relevante…"
      />
      <Button size="sm" className="self-end" disabled={isPending} onClick={salvar}>
        {isPending && <Loader2 className="animate-spin" />}
        Salvar
      </Button>
    </div>
  );
}
