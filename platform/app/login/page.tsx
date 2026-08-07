import { Suspense } from "react";
import Image from "next/image";
import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Entrar — Find4You Business Platform",
};

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          {/* Fundo branco fixo: a wordmark colorida (o "4" é slate escuro)
              só tem contraste garantido sobre claro — ver design-system/logos.md.
              O monograma (usado na sidebar) já carrega seu próprio fundo branco. */}
          <div className="rounded-xl bg-white px-5 py-3 shadow-sm">
            <Image src="/logo-wordmark.png" alt="Find4You" width={200} height={79} priority />
          </div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Business Platform
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          É cliente ou candidato?{" "}
          <a href="/portal-login" className="underline underline-offset-2">
            Acesse seu portal aqui
          </a>
          .
        </p>
      </div>
    </div>
  );
}
