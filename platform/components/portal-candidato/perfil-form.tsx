"use client";

import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { disponibilidadeValues, disponibilidadeLabel, csvToArray } from "@/modules/ats/schemas";
import { proporEdicaoPerfil } from "@/modules/portal-candidato/actions";

export type MeuPerfilClient = {
  telefone: string | null;
  whatsapp: string | null;
  linkedin: string | null;
  github: string | null;
  portfolioUrl: string | null;
  curriculoUrl: string | null;
  cidade: string | null;
  estado: string | null;
  pretensaoSalarial: number | null;
  disponibilidade: string | null;
  skills: string[];
};

type FormValues = {
  telefone: string;
  whatsapp: string;
  linkedin: string;
  github: string;
  portfolioUrl: string;
  curriculoUrl: string;
  cidade: string;
  estado: string;
  pretensaoSalarial: string;
  disponibilidade: (typeof disponibilidadeValues)[number] | "";
  skills: string;
};

export function PerfilForm({ perfil, temPendente }: { perfil: MeuPerfilClient; temPendente: boolean }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      telefone: perfil.telefone ?? "",
      whatsapp: perfil.whatsapp ?? "",
      linkedin: perfil.linkedin ?? "",
      github: perfil.github ?? "",
      portfolioUrl: perfil.portfolioUrl ?? "",
      curriculoUrl: perfil.curriculoUrl ?? "",
      cidade: perfil.cidade ?? "",
      estado: perfil.estado ?? "",
      pretensaoSalarial: perfil.pretensaoSalarial?.toString() ?? "",
      disponibilidade: (perfil.disponibilidade as FormValues["disponibilidade"]) ?? "",
      skills: perfil.skills.join(", "),
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await proporEdicaoPerfil({
        telefone: values.telefone,
        whatsapp: values.whatsapp,
        linkedin: values.linkedin,
        github: values.github,
        portfolioUrl: values.portfolioUrl,
        curriculoUrl: values.curriculoUrl,
        cidade: values.cidade,
        estado: values.estado,
        pretensaoSalarial: values.pretensaoSalarial ? Number(values.pretensaoSalarial) : undefined,
        disponibilidade: values.disponibilidade || undefined,
        skills: csvToArray(values.skills),
      });
      toast.success("Edição enviada para revisão da Find4You.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a edição.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" {...register("telefone")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" {...register("whatsapp")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="linkedin">LinkedIn</Label>
          <Input id="linkedin" {...register("linkedin")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="github">GitHub</Label>
          <Input id="github" {...register("github")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="portfolioUrl">Portfólio</Label>
          <Input id="portfolioUrl" {...register("portfolioUrl")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="curriculoUrl">Link do currículo</Label>
          <Input id="curriculoUrl" {...register("curriculoUrl")} />
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
          <Label htmlFor="pretensaoSalarial">Pretensão salarial</Label>
          <Input id="pretensaoSalarial" type="number" min={0} {...register("pretensaoSalarial")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Disponibilidade</Label>
          <Controller
            control={control}
            name="disponibilidade"
            render={({ field }) => (
              <Select items={disponibilidadeLabel} value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
        <Label htmlFor="skills">Skills</Label>
        <Input id="skills" placeholder="React, Node.js, PostgreSQL…" {...register("skills")} />
      </div>

      {temPendente && (
        <p className="text-sm text-muted-foreground">
          Você já tem uma edição aguardando revisão — o botão abaixo ficará disponível de novo assim
          que ela for analisada.
        </p>
      )}

      <Button type="submit" disabled={isSubmitting || temPendente} className="self-end">
        {isSubmitting && <Loader2 className="animate-spin" />}
        Enviar para revisão
      </Button>
    </form>
  );
}
