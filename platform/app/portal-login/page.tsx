import { Suspense } from "react";
import Image from "next/image";
import type { Metadata } from "next";
import { PortalLoginForm } from "@/components/portal-login-form";

export const metadata: Metadata = {
  title: "Acesso ao portal — Find4You",
};

export default function PortalLoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="rounded-xl bg-white px-5 py-3 shadow-sm">
            <Image src="/logo-wordmark.png" alt="Find4You" width={200} height={79} priority />
          </div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Portal do cliente e do candidato
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <Suspense fallback={null}>
            <PortalLoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          É da equipe Find4You?{" "}
          <a href="/login" className="underline underline-offset-2">
            Entre por aqui
          </a>
          .
        </p>
      </div>
    </div>
  );
}
