"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Unplug } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { desconectarIntegracao, conectarWhatsapp } from "@/modules/integracoes/actions";
import {
  provedorIntegracaoLabel,
  provedorIntegracaoDescricao,
  type ProvedorIntegracao,
} from "@/modules/integracoes/schemas";

type Integracao = {
  provedor: ProvedorIntegracao;
  conectado: boolean;
  contaExterna: string | null;
  conectadoEm: string | null;
};

export function IntegracoesView({ integracoes }: { integracoes: Integracao[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const conectado = searchParams.get("conectado");
    const erro = searchParams.get("erro");
    if (conectado) {
      toast.success(`${provedorIntegracaoLabel[conectado as ProvedorIntegracao] ?? conectado} conectado.`);
      router.replace("/configuracoes/integracoes");
    }
    if (erro) {
      toast.error(`Não foi possível conectar: ${erro}`);
      router.replace("/configuracoes/integracoes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-4">
      {integracoes.map((i) =>
        i.provedor === "whatsapp" ? (
          <WhatsappCard key={i.provedor} integracao={i} />
        ) : (
          <OAuthCard key={i.provedor} integracao={i} />
        ),
      )}
    </div>
  );
}

function CardShell({
  provedor,
  conectado,
  contaExterna,
  children,
}: {
  provedor: ProvedorIntegracao;
  conectado: boolean;
  contaExterna: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-sm font-semibold">{provedorIntegracaoLabel[provedor]}</h2>
          <p className="text-xs text-muted-foreground">{provedorIntegracaoDescricao[provedor]}</p>
        </div>
        {conectado && (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="size-3.5" />
            Conectado{contaExterna ? ` — ${contaExterna}` : ""}
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}

function OAuthCard({ integracao }: { integracao: Integracao }) {
  const [isPending, startTransition] = useTransition();

  function desconectar() {
    startTransition(async () => {
      try {
        await desconectarIntegracao(integracao.provedor);
        toast.success("Desconectado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível desconectar.");
      }
    });
  }

  return (
    <CardShell provedor={integracao.provedor} conectado={integracao.conectado} contaExterna={integracao.contaExterna}>
      <div className="flex justify-end">
        {integracao.conectado ? (
          <Button size="sm" variant="outline" disabled={isPending} onClick={desconectar}>
            {isPending ? <Loader2 className="animate-spin" /> : <Unplug />}
            Desconectar
          </Button>
        ) : (
          <a href={`/api/integracoes/${integracao.provedor}/connect`} className={buttonVariants({ size: "sm" })}>
            Conectar
          </a>
        )}
      </div>
    </CardShell>
  );
}

function WhatsappCard({ integracao }: { integracao: Integracao }) {
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isPending, startTransition] = useTransition();

  function conectar() {
    startTransition(async () => {
      try {
        await conectarWhatsapp({ phoneNumberId, accessToken });
        toast.success("WhatsApp conectado.");
        setPhoneNumberId("");
        setAccessToken("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível conectar.");
      }
    });
  }

  function desconectar() {
    startTransition(async () => {
      try {
        await desconectarIntegracao("whatsapp");
        toast.success("Desconectado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível desconectar.");
      }
    });
  }

  return (
    <CardShell provedor="whatsapp" conectado={integracao.conectado} contaExterna={integracao.contaExterna}>
      {integracao.conectado ? (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" disabled={isPending} onClick={desconectar}>
            {isPending ? <Loader2 className="animate-spin" /> : <Unplug />}
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="phoneNumberId" className="text-xs text-muted-foreground">
              Phone Number ID
            </Label>
            <Input
              id="phoneNumberId"
              className="w-56"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="accessToken" className="text-xs text-muted-foreground">
              Access token (Meta Business Manager)
            </Label>
            <Input
              id="accessToken"
              type="password"
              className="w-72"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
          </div>
          <Button size="sm" disabled={isPending || !phoneNumberId || !accessToken} onClick={conectar}>
            {isPending && <Loader2 className="animate-spin" />}
            Conectar
          </Button>
        </div>
      )}
    </CardShell>
  );
}
