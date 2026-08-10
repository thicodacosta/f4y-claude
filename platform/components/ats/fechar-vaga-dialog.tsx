"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Link from "next/link";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fecharVagaSchema, type FecharVagaFormInput } from "@/modules/ats/schemas";
import { fecharVaga } from "@/modules/ats/actions";
import type { VagaClient } from "@/modules/ats/serialize";

export type ContatoClient = {
  id: string;
  nome: string;
  email: string | null;
  cargo: string | null;
  empresaId: string | null;
};

/** Categoria não é persistida — só decide, aqui, quais campos são
 * obrigatórios (ver mesma derivação em nova-vaga-dialog.tsx). */
function categoriaDaVaga(vertical: string): "alocacao" | "recrutamento" {
  return vertical === "alocacao_tech" ? "alocacao" : "recrutamento";
}

export function FecharVagaDialog({
  open,
  onOpenChange,
  vaga,
  novaEtapaId,
  contatos,
  onFechada,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaga: VagaClient | null;
  novaEtapaId: string;
  contatos: ContatoClient[];
  onFechada: (vagaId: string, novaEtapaId: string, valorVenda: number) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FecharVagaFormInput>({
    resolver: zodResolver(fecharVagaSchema),
  });

  useEffect(() => {
    if (!vaga) return;
    reset({
      vagaId: vaga.id,
      novaEtapaId,
      categoria: categoriaDaVaga(vaga.vertical),
      valorVenda: vaga.valor ?? undefined,
      contatosNfIds: [],
    });
  }, [vaga, novaEtapaId, reset]);

  if (!vaga) return null;

  const categoria = categoriaDaVaga(vaga.vertical);
  const contatosDaEmpresa = contatos.filter((c) => c.empresaId === vaga.empresaId);

  async function onSubmit(values: FecharVagaFormInput) {
    if (!vaga) return;
    try {
      await fecharVaga(values);
      toast.success("Vaga fechada — lançamento criado em Financeiro.");
      onFechada(vaga.id, novaEtapaId, Number(values.valorVenda));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível fechar a vaga.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fechar vaga</DialogTitle>
          <DialogDescription>
            {vaga.cargo} — {vaga.empresaNome}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="valorVenda">Valor de venda (R$)</Label>
              <Input id="valorVenda" type="number" step="0.01" min={0} {...register("valorVenda")} />
              {errors.valorVenda && <p className="text-sm text-destructive">{errors.valorVenda.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dataInicio">Data de início</Label>
              <Input id="dataInicio" type="date" {...register("dataInicio")} />
              {errors.dataInicio && <p className="text-sm text-destructive">{errors.dataInicio.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="dataEmissaoNf">Data de emissão da NF</Label>
            <Input id="dataEmissaoNf" type="date" {...register("dataEmissaoNf")} />
            {errors.dataEmissaoNf && <p className="text-sm text-destructive">{errors.dataEmissaoNf.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Contato(s) para emissão de NF</Label>
            {contatosDaEmpresa.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {vaga.empresaNome} não tem contato cadastrado.{" "}
                <Link href={`/empresas/${vaga.empresaId}`} className="underline">
                  Cadastrar contato
                </Link>
              </p>
            ) : (
              <Controller
                control={control}
                name="contatosNfIds"
                render={({ field }) => (
                  <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                    {contatosDaEmpresa.map((c) => {
                      const marcado = (field.value ?? []).includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-input"
                            checked={marcado}
                            onChange={(e) => {
                              const atual = field.value ?? [];
                              field.onChange(e.target.checked ? [...atual, c.id] : atual.filter((id) => id !== c.id));
                            }}
                          />
                          {c.nome}
                          {c.cargo && <span className="text-xs text-muted-foreground">— {c.cargo}</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
              />
            )}
            {errors.contatosNfIds && <p className="text-sm text-destructive">{errors.contatosNfIds.message}</p>}
          </div>

          {categoria === "alocacao" && (
            <div className="grid grid-cols-2 gap-4 rounded-md border border-border p-3">
              <div className="col-span-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Categoria Alocação
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dataInicioProfissional">Início do profissional</Label>
                <Input id="dataInicioProfissional" type="date" {...register("dataInicioProfissional")} />
                {errors.dataInicioProfissional && (
                  <p className="text-sm text-destructive">{errors.dataInicioProfissional.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dataTerminoAlocacao">Término da alocação</Label>
                <Input id="dataTerminoAlocacao" type="date" {...register("dataTerminoAlocacao")} />
                {errors.dataTerminoAlocacao && (
                  <p className="text-sm text-destructive">{errors.dataTerminoAlocacao.message}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Fechar vaga
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
