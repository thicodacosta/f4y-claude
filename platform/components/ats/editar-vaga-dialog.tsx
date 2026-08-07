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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  atualizarVagaSchema,
  prioridadeVagaValues,
  prioridadeVagaLabel,
  modeloTrabalhoValues,
  modeloTrabalhoLabel,
  senioridadeValues,
  senioridadeLabel,
  type AtualizarVagaFormInput,
} from "@/modules/ats/schemas";
import { atualizarVaga } from "@/modules/ats/actions";
import type { VagaClient } from "@/modules/ats/serialize";
import { GerarJdButton } from "@/components/ats/gerar-jd-button";

const SEM_RESPONSAVEL = "__nenhum__";

export function EditarVagaDialog({
  open,
  onOpenChange,
  vaga,
  equipe,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaga: VagaClient;
  equipe: { id: string; nome: string }[];
}) {
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { isSubmitting },
  } = useForm<AtualizarVagaFormInput>({
    resolver: zodResolver(atualizarVagaSchema),
    defaultValues: {
      vagaId: vaga.id,
      cargo: vaga.cargo,
      consultorId: vaga.consultorId,
      recrutadorId: vaga.recrutadorId,
      quantidadePosicoes: vaga.quantidadePosicoes,
      valor: vaga.valor,
      prioridade: vaga.prioridade as (typeof prioridadeVagaValues)[number],
      modeloTrabalho: vaga.modeloTrabalho as (typeof modeloTrabalhoValues)[number] | null,
      senioridade: vaga.senioridade as (typeof senioridadeValues)[number] | null,
      cidade: vaga.cidade,
      estado: vaga.estado,
      salarioMin: vaga.salarioMin,
      salarioMax: vaga.salarioMax,
      beneficios: vaga.beneficios,
      stackTecnologica: vaga.stackTecnologica,
      skillsRequeridas: vaga.skillsRequeridas,
      jobDescription: vaga.jobDescription,
      gestorNome: vaga.gestorNome,
      gestorContato: vaga.gestorContato,
      dataLimite: vaga.dataLimite ? vaga.dataLimite.slice(0, 10) : null,
      slaDias: vaga.slaDias,
    },
  });

  async function onSubmit(values: AtualizarVagaFormInput) {
    try {
      await atualizarVaga(values);
      toast.success("Vaga atualizada.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a vaga.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar vaga</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cargo">Cargo</Label>
            <Input id="cargo" {...register("cargo")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Consultor comercial</Label>
              <Controller
                control={control}
                name="consultorId"
                render={({ field }) => (
                  <Select
                    items={{ [SEM_RESPONSAVEL]: "—", ...Object.fromEntries(equipe.map((u) => [u.id, u.nome])) }}
                    value={field.value ?? SEM_RESPONSAVEL}
                    onValueChange={(v) => field.onChange(!v || v === SEM_RESPONSAVEL ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_RESPONSAVEL}>—</SelectItem>
                      {equipe.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Recrutador</Label>
              <Controller
                control={control}
                name="recrutadorId"
                render={({ field }) => (
                  <Select
                    items={{ [SEM_RESPONSAVEL]: "—", ...Object.fromEntries(equipe.map((u) => [u.id, u.nome])) }}
                    value={field.value ?? SEM_RESPONSAVEL}
                    onValueChange={(v) => field.onChange(!v || v === SEM_RESPONSAVEL ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_RESPONSAVEL}>—</SelectItem>
                      {equipe.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome}
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
              <Label htmlFor="valor">Valor da vaga (R$)</Label>
              <Input id="valor" type="number" step="0.01" min={0} {...register("valor")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Prioridade</Label>
              <Controller
                control={control}
                name="prioridade"
                render={({ field }) => (
                  <Select items={prioridadeVagaLabel} value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
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
            <div className="flex flex-col gap-2">
              <Label>Senioridade</Label>
              <Controller
                control={control}
                name="senioridade"
                render={({ field }) => (
                  <Select
                    items={senioridadeLabel}
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v || null)}
                  >
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Modelo de trabalho</Label>
              <Controller
                control={control}
                name="modeloTrabalho"
                render={({ field }) => (
                  <Select
                    items={modeloTrabalhoLabel}
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v || null)}
                  >
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="slaDias">SLA (dias)</Label>
              <Input id="slaDias" type="number" min={0} {...register("slaDias")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" {...register("cidade")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="estado">Estado</Label>
              <Input id="estado" maxLength={2} {...register("estado")} />
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
            <Label htmlFor="beneficios">Benefícios</Label>
            <Input id="beneficios" {...register("beneficios")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Stack técnica</Label>
              <Controller
                control={control}
                name="stackTecnologica"
                render={({ field }) => (
                  <Input
                    key={(field.value ?? []).join(",")}
                    placeholder="React, Node.js…"
                    defaultValue={(field.value ?? []).join(", ")}
                    onBlur={(e) => field.onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Skills requeridas</Label>
              <Controller
                control={control}
                name="skillsRequeridas"
                render={({ field }) => (
                  <Input
                    key={(field.value ?? []).join(",")}
                    placeholder="Liderança, inglês fluente…"
                    defaultValue={(field.value ?? []).join(", ")}
                    onBlur={(e) => field.onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="gestorNome">Gestor do cliente</Label>
              <Input id="gestorNome" {...register("gestorNome")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gestorContato">Contato do gestor</Label>
              <Input id="gestorContato" {...register("gestorContato")} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="dataLimite">Data limite</Label>
            <Input id="dataLimite" type="date" {...register("dataLimite")} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="jobDescription">Job Description</Label>
              <GerarJdButton
                getFormValues={() => ({
                  cargo: getValues("cargo"),
                  senioridade: getValues("senioridade"),
                  stackTecnologica: getValues("stackTecnologica"),
                  modeloTrabalho: getValues("modeloTrabalho"),
                  empresaId: vaga.empresaId,
                })}
                onGerado={(jd, skills) => {
                  setValue("jobDescription", jd);
                  if (skills.length > 0) setValue("skillsRequeridas", skills);
                }}
              />
            </div>
            <Controller
              control={control}
              name="jobDescription"
              render={({ field }) => (
                <Textarea
                  id="jobDescription"
                  rows={4}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
