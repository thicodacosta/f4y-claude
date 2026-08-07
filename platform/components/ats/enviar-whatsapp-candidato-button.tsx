"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { enviarWhatsappCandidatoSchema, type EnviarWhatsappCandidatoFormInput } from "@/modules/integracoes/schemas";
import { enviarWhatsappCandidato } from "@/modules/integracoes/actions";

export function EnviarWhatsappCandidatoButton({
  candidatoId,
  telefone,
}: {
  candidatoId: string;
  telefone: string | null;
}) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EnviarWhatsappCandidatoFormInput>({
    resolver: zodResolver(enviarWhatsappCandidatoSchema),
    defaultValues: { candidatoId },
  });

  async function onSubmit(values: EnviarWhatsappCandidatoFormInput) {
    try {
      await enviarWhatsappCandidato(values);
      toast.success("Mensagem enviada.");
      reset({ candidatoId, mensagem: "" });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a mensagem.");
    }
  }

  if (!telefone) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <MessageCircle />
        Enviar WhatsApp
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar WhatsApp para {telefone}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <input type="hidden" {...register("candidatoId")} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="mensagem">Mensagem</Label>
            <Textarea id="mensagem" rows={6} {...register("mensagem")} />
            {errors.mensagem && <p className="text-sm text-destructive">{errors.mensagem.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Enviar pelo WhatsApp
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
