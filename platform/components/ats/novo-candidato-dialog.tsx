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
  criarCandidatoSchema,
  disponibilidadeValues,
  disponibilidadeLabel,
  type CriarCandidatoFormInput,
} from "@/modules/ats/schemas";
import { criarCandidato } from "@/modules/ats/actions";

export function NovoCandidatoDialog({
  open,
  onOpenChange,
  onCriado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriado?: (candidatoId: string) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CriarCandidatoFormInput>({ resolver: zodResolver(criarCandidatoSchema) });

  async function onSubmit(values: CriarCandidatoFormInput) {
    try {
      const candidato = await criarCandidato(values);
      toast.success("Candidato cadastrado.");
      reset();
      onOpenChange(false);
      onCriado?.(candidato.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível cadastrar o candidato.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo candidato</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" {...register("nome")} />
            {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cargoAtual">Cargo atual</Label>
              <Input id="cargoAtual" {...register("cargoAtual")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="empresaAtual">Empresa atual</Label>
              <Input id="empresaAtual" {...register("empresaAtual")} />
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
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" {...register("telefone")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="linkedin">LinkedIn</Label>
              <Input id="linkedin" placeholder="linkedin.com/in/…" {...register("linkedin")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="github">GitHub</Label>
              <Input id="github" placeholder="github.com/…" {...register("github")} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="skills">Skills</Label>
            <Input id="skills" placeholder="React, Node.js, PostgreSQL…" {...register("skills")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tecnologias">Tecnologias</Label>
            <Input id="tecnologias" placeholder="AWS, Docker, Kubernetes…" {...register("tecnologias")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pretensaoSalarial">Pretensão salarial (R$)</Label>
              <Input id="pretensaoSalarial" type="number" step="0.01" min={0} {...register("pretensaoSalarial")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Disponibilidade</Label>
              <Controller
                control={control}
                name="disponibilidade"
                render={({ field }) => (
                  <Select items={disponibilidadeLabel} value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {disponibilidadeValues.map((v) => (
                        <SelectItem key={v} value={v}>
                          {disponibilidadeLabel[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
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
              Cadastrar candidato
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
