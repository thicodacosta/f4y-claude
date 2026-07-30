import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Entrar — Find4You Business Platform",
};

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div
            className="flex size-11 items-center justify-center rounded-md font-heading text-sm font-extrabold text-white"
            style={{ background: "linear-gradient(135deg, var(--primary), var(--brand-indigo))" }}
          >
            F4
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold">Find4You</h1>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Business Platform
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Acesso restrito à equipe e clientes/candidatos convidados da Find4You.
        </p>
      </div>
    </div>
  );
}
