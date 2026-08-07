"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { enviarEmailCandidatoSchema, type EnviarEmailCandidatoFormInput } from "@/modules/integracoes/schemas";
import { enviarEmailCandidato } from "@/modules/integracoes/actions";

export function EnviarEmailCandidatoButton({ candidatoId, email }: { candidatoId: string; email: string | null }) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EnviarEmailCandidatoFormInput>({
    resolver: zodResolver(enviarEmailCandidatoSchema),
    defaultValues: { candidatoId },
  });

  async function onSubmit(values: EnviarEmailCandidatoFormInput) {
    try {
      await enviarEmailCandidato(values);
      toast.success("E-mail enviado.");
      reset({ candidatoId, assunto: "", corpo: "" });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o e-mail.");
    }
  }

  if (!email) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Mail />
        Enviar e-mail
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar e-mail para {email}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <input type="hidden" {...register("candidatoId")} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="assunto">Assunto</Label>
            <Input id="assunto" {...register("assunto")} />
            {errors.assunto && <p className="text-sm text-destructive">{errors.assunto.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="corpo">Mensagem</Label>
            <Textarea id="corpo" rows={6} {...register("corpo")} />
            {errors.corpo && <p className="text-sm text-destructive">{errors.corpo.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Enviar pelo Gmail
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
