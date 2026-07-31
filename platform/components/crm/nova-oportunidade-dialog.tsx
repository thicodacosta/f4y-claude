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
import { criarOportunidadeSchema, verticalNegocioValues, verticalNegocioLabel, type CriarOportunidadeFormInput } from "@/modules/crm/schemas";
import { criarOportunidade } from "@/modules/crm/actions";

const NOVA_EMPRESA = "__nova__";

export function NovaOportunidadeDialog({
  open,
  onOpenChange,
  empresas,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresas: { id: string; nome: string }[];
}) {
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>("");

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CriarOportunidadeFormInput>({
    resolver: zodResolver(criarOportunidadeSchema),
    // `vertical` precisa de um valor inicial não-undefined — senão o Select
    // (Base UI) nasce "não controlado" e vira "controlado" só quando o
    // usuário escolhe algo, o que o Base UI rejeita com um warning e perde o
    // valor selecionado.
    defaultValues: { valorEstimado: 0, vertical: verticalNegocioValues[0] },
  });

  async function onSubmit(values: CriarOportunidadeFormInput) {
    try {
      await criarOportunidade(values);
      toast.success("Oportunidade criada.");
      reset();
      setEmpresaSelecionada("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a oportunidade.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova oportunidade</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
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
                // `empresaId` só existe quando uma empresa já cadastrada foi
                // escolhida — undefined (nunca string vazia) quando é nova,
                // já que o schema é `z.string().uuid().optional()` e "" não
                // satisfaz `.uuid()` mesmo sendo opcional.
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

          <div className="flex flex-col gap-2">
            <Label>Vertical</Label>
            <Controller
              control={control}
              name="vertical"
              render={({ field }) => (
                <Select items={verticalNegocioLabel} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a vertical" />
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
            {errors.vertical && <p className="text-sm text-destructive">{errors.vertical.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="valorEstimado">Valor estimado (R$)</Label>
              <Input id="valorEstimado" type="number" step="0.01" min={0} {...register("valorEstimado")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="previsaoFechamento">Previsão de fechamento</Label>
              <Input id="previsaoFechamento" type="date" {...register("previsaoFechamento")} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="origem">Origem</Label>
            <Input id="origem" placeholder="LinkedIn, indicação, site…" {...register("origem")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" {...register("observacoes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Criar oportunidade
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
