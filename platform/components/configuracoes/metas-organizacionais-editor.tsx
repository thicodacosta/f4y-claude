"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { criarOuAtualizarMetaOrganizacional, excluirMetaOrganizacional } from "@/modules/metas/actions";
import { categoriaMetaValues, categoriaMetaLabel } from "@/modules/metas/schemas";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type MetaOrganizacionalLinha = {
  id: string;
  categoria: string;
  valorAlvo: number;
  valorAtual: number;
  gap: number;
  percentual: number;
};

type FormValues = {
  categoria: (typeof categoriaMetaValues)[number];
  valorAlvo: string;
};

/** Goal Center — meta da empresa/vertical, mesmo padrão de UI de
 * MetasEditor (metas por usuário), mas alimentando o Forecast Engine e o
 * Gap-to-Goal em /intelligence/forecast em vez do leaderboard. */
export function MetasOrganizacionaisEditor({ metas }: { metas: MetaOrganizacionalLinha[] }) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: { categoria: "todas", valorAlvo: "" } });

  const hoje = new Date();

  async function onSubmit(values: FormValues) {
    try {
      await criarOuAtualizarMetaOrganizacional({
        categoria: values.categoria,
        ano: hoje.getFullYear(),
        mes: hoje.getMonth() + 1,
        valorAlvo: values.valorAlvo,
      });
      toast.success("Meta salva.");
      reset({ categoria: values.categoria, valorAlvo: "" });
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
          <Label>Escopo</Label>
          <Controller
            control={control}
            name="categoria"
            render={({ field }) => (
              <Select items={categoriaMetaLabel} value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoriaMetaValues.map((v) => (
                    <SelectItem key={v} value={v}>
                      {categoriaMetaLabel[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="valorAlvoOrg">Meta do mês (R$)</Label>
          <Input id="valorAlvoOrg" type="number" min={0} step="0.01" className="w-40" {...register("valorAlvo", { required: true })} />
        </div>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Plus />}
          Salvar meta
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        {metas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma meta organizacional definida para este mês.</p>
        ) : (
          metas.map((m) => <MetaRow key={m.id} meta={m} />)
        )}
      </div>
    </div>
  );
}

function MetaRow({ meta }: { meta: MetaOrganizacionalLinha }) {
  const [isPending, startTransition] = useTransition();
  const [removida, setRemovida] = useState(false);

  function remover() {
    startTransition(async () => {
      try {
        await excluirMetaOrganizacional(meta.id);
        setRemovida(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível excluir a meta.");
      }
    });
  }

  if (removida) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{categoriaMetaLabel[meta.categoria as (typeof categoriaMetaValues)[number]]}</span>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={remover}>
          {isPending ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, meta.percentual)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">
        {currency.format(meta.valorAtual)} / {currency.format(meta.valorAlvo)} ({meta.percentual}%) — gap {currency.format(meta.gap)}
      </span>
    </div>
  );
}
