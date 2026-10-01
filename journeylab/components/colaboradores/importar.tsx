"use client";

import { useState, useTransition } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { importarColaboradores, type ResultadoImportacao } from "@/lib/colaboradores/actions";

const MODELO = "nome;email;cargo;equipe;area;gestor_email;data_admissao;situacao\nMaria Silva;maria@empresa.com.br;Analista Financeira;Financeiro;Corporativo;joao@empresa.com.br;15/03/2023;ativo\n";

export function ImportarColaboradores() {
  const [r, setR] = useState<ResultadoImportacao | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          iniciar(async () => {
            const res = await importarColaboradores(fd);
            setR(res);
            if (res.erro) toast.error(res.erro);
            else toast.success(res.ok);
          });
        }}
      >
        <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-semibold">
          Arquivo CSV
          <input name="arquivo" type="file" accept=".csv,text/csv" required className="rounded-lg border border-input bg-background p-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm" />
        </label>
        <button type="submit" disabled={pendente} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {pendente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />} Importar
        </button>
      </form>
      <a href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + MODELO)}`} download="modelo-colaboradores.csv" className="w-fit text-sm font-medium text-teal-strong hover:underline">
        Baixar modelo de planilha (CSV)
      </a>
      {r && !r.erro && (
        <div role="status" className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-semibold">{r.ok}</p>
          {r.ignoradas && r.ignoradas.length > 0 && <p className="text-muted-foreground">Colunas ignoradas: {r.ignoradas.join(", ")}</p>}
          {r.erros && r.erros.length > 0 && (
            <ul className="max-h-60 list-disc overflow-y-auto pl-5 text-destructive">
              {r.erros.map((e) => (
                <li key={`${e.linha}-${e.motivo}`}>
                  Linha {e.linha}: {e.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {r?.erro && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {r.erro}
        </p>
      )}
    </div>
  );
}
