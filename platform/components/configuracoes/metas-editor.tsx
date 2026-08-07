"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { criarOuAtualizarMeta, excluirMeta } from "@/modules/metas/actions";
import { metaTipoValues, metaTipoLabel } from "@/modules/metas/schemas";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Usuario = { id: string; nome: string; papel: string | null };
type MetaLinha = {
  id: string;
  usuarioId: string;
  usuarioNome: string;
  tipo: string;
  valorAlvo: number;
  valorAtual: number;
  percentual: number;
};

type FormValues = {
  usuarioId: string;
  tipo: (typeof metaTipoValues)[number];
  valorAlvo: string;
};

export function MetasEditor({ usuarios, metas }: { usuarios: Usuario[]; metas: MetaLinha[] }) {
  const { control, register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: { tipo: "comercial", valorAlvo: "" },
  });

  const hoje = new Date();

  async function onSubmit(values: FormValues) {
    try {
      await criarOuAtualizarMeta({
        usuarioId: values.usuarioId,
        tipo: values.tipo,
        ano: hoje.getFullYear(),
        mes: hoje.getMonth() + 1,
        valorAlvo: values.valorAlvo,
      });
      toast.success("Meta salva.");
      reset({ tipo: values.tipo, valorAlvo: "", usuarioId: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a meta.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
        noValidate
      >
        <div className="flex flex-col gap-1">
          <Label>Pessoa</Label>
          <Controller
            control={control}
            name="usuarioId"
            rules={{ required: true }}
            render={({ field }) => (
              <Select
                items={Object.fromEntries(usuarios.map((u) => [u.id, u.nome]))}
                value={field.value ?? ""}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Tipo</Label>
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => (
              <Select items={metaTipoLabel} value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metaTipoValues.map((v) => (
                    <SelectItem key={v} value={v}>
                      {metaTipoLabel[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="valorAlvo">Meta do mês</Label>
          <Input id="valorAlvo" type="number" min={0} step="0.01" className="w-40" {...register("valorAlvo", { required: true })} />
        </div>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Plus />}
          Salvar meta
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        {metas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma meta definida para este mês.</p>
        ) : (
          metas.map((m) => <MetaRow key={m.id} meta={m} />)
        )}
      </div>
    </div>
  );
}

function MetaRow({ meta }: { meta: MetaLinha }) {
  const [isPending, startTransition] = useTransition();
  const [removida, setRemovida] = useState(false);

  function remover() {
    startTransition(async () => {
      try {
        await excluirMeta(meta.id);
        setRemovida(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível excluir a meta.");
      }
    });
  }

  if (removida) return null;

  const valorFormatado = meta.tipo === "comercial" ? currency.format(meta.valorAtual) : String(meta.valorAtual);
  const alvoFormatado = meta.tipo === "comercial" ? currency.format(meta.valorAlvo) : String(meta.valorAlvo);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {meta.usuarioNome} · {metaTipoLabel[meta.tipo as (typeof metaTipoValues)[number]]}
        </span>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={remover}>
          {isPending ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, meta.percentual)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {valorFormatado} / {alvoFormatado} ({meta.percentual}%)
      </span>
    </div>
  );
}
