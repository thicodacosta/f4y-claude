"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { aceitarTermos, definirNovaSenha, entrar, solicitarRedefinicao, type EstadoForm } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function Mensagem({ estado }: { estado: EstadoForm }) {
  if (estado.erro)
    return (
      <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {estado.erro}
      </p>
    );
  if (estado.ok)
    return (
      <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-sm text-[#0E7A4E] dark:text-success">
        {estado.ok}
      </p>
    );
  return null;
}

function Campo({
  id,
  rotulo,
  ...props
}: { id: string; rotulo: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} name={id} className="h-10" {...props} />
    </div>
  );
}

function Enviar({ pendente, children }: { pendente: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" className="h-10" disabled={pendente}>
      {pendente && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

const ERROS_URL: Record<string, string> = {
  link: "O link é inválido ou expirou. Se você já confirmou o e-mail, entre com sua senha; se não, solicite um novo link.",
};

export function FormularioLogin() {
  const params = useSearchParams();
  const erroUrl = params.get("erro");
  const [estado, acao, pendente] = useActionState(
    entrar,
    erroUrl ? { erro: ERROS_URL[erroUrl] ?? "Não foi possível concluir. Tente novamente." } : {},
  );

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="redirectTo" value={params.get("redirectTo") ?? ""} />
      <Campo id="email" rotulo="E-mail" type="email" autoComplete="email" required defaultValue={estado.campos?.email} />
      <Campo id="senha" rotulo="Senha" type="password" autoComplete="current-password" required />
      <Mensagem estado={estado} />
      <Enviar pendente={pendente}>Entrar</Enviar>
      <Link href="/recuperar-senha" className="text-center text-sm text-muted-foreground hover:text-foreground">
        Esqueci minha senha
      </Link>
    </form>
  );
}

export function FormularioRecuperar() {
  const [estado, acao, pendente] = useActionState(solicitarRedefinicao, {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo id="email" rotulo="E-mail da conta" type="email" autoComplete="email" required />
      <Mensagem estado={estado} />
      <Enviar pendente={pendente}>Enviar link</Enviar>
    </form>
  );
}

export function FormularioNovaSenha() {
  const [estado, acao, pendente] = useActionState(definirNovaSenha, {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo id="senha" rotulo="Nova senha" type="password" autoComplete="new-password" required minLength={8} />
      <Campo id="confirmacao" rotulo="Confirme a nova senha" type="password" autoComplete="new-password" required />
      <Mensagem estado={estado} />
      <Enviar pendente={pendente}>Salvar nova senha</Enviar>
    </form>
  );
}

export function FormularioAceite() {
  const [estado, acao, pendente] = useActionState(aceitarTermos, {});
  return (
    <form action={acao} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3 text-sm">
        <legend className="sr-only">Consentimentos</legend>
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="aceite" required className="mt-0.5 size-4 accent-[var(--primary)]" />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" target="_blank" className="text-teal-strong underline underline-offset-2">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" target="_blank" className="text-teal-strong underline underline-offset-2">
              Política de privacidade
            </Link>
            .
          </span>
        </label>
      </fieldset>
      <Mensagem estado={estado} />
      <Enviar pendente={pendente}>Continuar</Enviar>
    </form>
  );
}
