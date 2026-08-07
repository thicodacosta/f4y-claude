"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().min(1, "Informe seu e-mail").email("E-mail inválido"),
});

type Values = z.infer<typeof schema>;

/** Fase 7 — cliente/candidato não tem senha: todo acesso ao portal é via
 * link enviado por e-mail (ver fluxos-usuario.md). Reaproveita a mesma rota
 * app/auth/confirm usada no convite inicial. */
export function PortalLoginForm() {
  const [enviado, setEnviado] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard` },
    });

    if (error) {
      setFormError("Não foi possível enviar o link. Tente novamente em instantes.");
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <MailCheck className="size-8 text-primary" />
        <p className="text-sm text-muted-foreground">
          Enviamos um link de acesso para o seu e-mail. Abra-o para entrar no portal.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        Enviar link de acesso
      </Button>
    </form>
  );
}
