"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { criarContratoSchema, type CriarContratoFormInput } from "@/modules/alocacao/schemas";
import { criarContrato } from "@/modules/alocacao/actions";

export function ContratoDialog({
  open,
  onOpenChange,
  vagaId,
  candidatosDaVaga,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vagaId: string;
  candidatosDaVaga: { candidatoId: string; nome: string }[];
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CriarContratoFormInput>({
    resolver: zodResolver(criarContratoSchema),
    defaultValues: { vagaId, prazoMeses: 6 },
  });

  async function onSubmit(values: CriarContratoFormInput) {
    try {
      await criarContrato(values);
      toast.success("Contrato criado.");
      reset({ vagaId, prazoMeses: 6 });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o contrato.");
    }
  }

  if (candidatosDaVaga.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo contrato de alocação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Adicione um candidato ao processo desta vaga antes de criar o contrato.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo contrato de alocação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label>Profissional</Label>
            <Controller
              control={control}
              name="candidatoId"
              render={({ field }) => (
                <Select
                  items={Object.fromEntries(candidatosDaVaga.map((c) => [c.candidatoId, c.nome]))}
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidatosDaVaga.map((c) => (
                      <SelectItem key={c.candidatoId} value={c.candidatoId}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.candidatoId && <p className="text-sm text-destructive">{errors.candidatoId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rate">Rate (R$/mês)</Label>
              <Input id="rate" type="number" step="0.01" min={0} {...register("rate")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="prazoMeses">Prazo (meses)</Label>
              <Input id="prazoMeses" type="number" min={1} {...register("prazoMeses")} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="dataInicio">Data de início</Label>
            <Input id="dataInicio" type="date" {...register("dataInicio")} />
            {errors.dataInicio && <p className="text-sm text-destructive">{errors.dataInicio.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Criar contrato
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
