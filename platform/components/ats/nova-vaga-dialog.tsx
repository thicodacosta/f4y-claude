"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { verticalNegocioValues, verticalNegocioLabel } from "@/modules/crm/schemas";
import {
  criarVagaSchema,
  prioridadeVagaValues,
  prioridadeVagaLabel,
  modeloTrabalhoValues,
  modeloTrabalhoLabel,
  senioridadeValues,
  senioridadeLabel,
  type CriarVagaFormInput,
} from "@/modules/ats/schemas";
import { criarVaga } from "@/modules/ats/actions";

const NOVA_EMPRESA = "__nova__";

export function NovaVagaDialog({
  open,
  onOpenChange,
  empresas,
  onCriada,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresas: { id: string; nome: string }[];
  onCriada?: (vagaId: string) => void;
}) {
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("");

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CriarVagaFormInput>({
    resolver: zodResolver(criarVagaSchema),
    defaultValues: { vertical: verticalNegocioValues[0], prioridade: "media", quantidadePosicoes: 1 },
  });

  async function onSubmit(values: CriarVagaFormInput) {
    try {
      const vaga = await criarVaga(values);
      toast.success("Vaga criada.");
      reset();
      setEmpresaSelecionada("");
      onOpenChange(false);
      onCriada?.(vaga.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a vaga.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova vaga</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cargo">Cargo</Label>
            <Input id="cargo" placeholder="Ex.: Engenheiro de Software Sênior" {...register("cargo")} />
            {errors.cargo && <p className="text-sm text-destructive">{errors.cargo.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Empresa</Label>
            <Select
              items={{
                ...Object.fromEntries(empresas.map((e) => [e.id, e.nome])),
                [NOVA_EMPRESA]: "+ Nova empresa",
              }}
              value={empresaSelecionada}
              onValueChange={(value) => {
                const v = value ?? "";
                setEmpresaSelecionada(v);
                setValue("empresaId", v && v !== NOVA_EMPRESA ? v : undefined);
                if (v === NOVA_EMPRESA) setValue("empresaNovaNome", "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione ou crie uma empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id}>
                    {empresa.nome}
                  </SelectItem>
                ))}
                <SelectItem value={NOVA_EMPRESA}>+ Nova empresa</SelectItem>
              </SelectContent>
            </Select>
            {empresaSelecionada === NOVA_EMPRESA && (
              <Input placeholder="Nome da nova empresa" {...register("empresaNovaNome")} />
            )}
            {errors.empresaNovaNome && (
              <p className="text-sm text-destructive">{errors.empresaNovaNome.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Vertical</Label>
              <Controller
                control={control}
                name="vertical"
                render={({ field }) => (
                  <Select items={verticalNegocioLabel} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vertical" />
                    </SelectTrigger>
                    <SelectContent>
                      {verticalNegocioValues.map((v) => (
                        <SelectItem key={v} value={v}>
                          {verticalNegocioLabel[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Prioridade</Label>
              <Controller
                control={control}
                name="prioridade"
                render={({ field }) => (
                  <Select items={prioridadeVagaLabel} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      {prioridadeVagaValues.map((v) => (
                        <SelectItem key={v} value={v}>
                          {prioridadeVagaLabel[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quantidadePosicoes">Posições</Label>
              <Input id="quantidadePosicoes" type="number" min={1} {...register("quantidadePosicoes")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Senioridade</Label>
              <Controller
                control={control}
                name="senioridade"
                render={({ field }) => (
                  <Select items={senioridadeLabel} value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {senioridadeValues.map((v) => (
                        <SelectItem key={v} value={v}>
                          {senioridadeLabel[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Modelo</Label>
              <Controller
                control={control}
                name="modeloTrabalho"
                render={({ field }) => (
                  <Select items={modeloTrabalhoLabel} value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {modeloTrabalhoValues.map((v) => (
                        <SelectItem key={v} value={v}>
                          {modeloTrabalhoLabel[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" {...register("cidade")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="estado">Estado</Label>
              <Input id="estado" placeholder="UF" maxLength={2} {...register("estado")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="salarioMin">Salário mín. (R$)</Label>
              <Input id="salarioMin" type="number" step="0.01" min={0} {...register("salarioMin")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="salarioMax">Salário máx. (R$)</Label>
              <Input id="salarioMax" type="number" step="0.01" min={0} {...register("salarioMax")} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="stackTecnologica">Stack técnica</Label>
            <Input id="stackTecnologica" placeholder="React, Node.js, PostgreSQL…" {...register("stackTecnologica")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="jobDescription">Job Description</Label>
            <Textarea id="jobDescription" rows={4} {...register("jobDescription")} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 rounded border-input" {...register("confidencial")} />
            Vaga confidencial (Executive Search)
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Criar vaga
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
