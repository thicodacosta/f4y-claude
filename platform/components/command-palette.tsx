"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Search, UserRound, Briefcase, Building2, GitPullRequest } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getVisibleNavGroups, type Papel } from "@/lib/nav";
import { buscaGlobal, type BuscaGlobalResultado } from "@/modules/busca/actions";

type ResultItem = {
  key: string;
  href: string;
  label: string;
  sublabel?: string;
  icon: LucideIcon;
};

type ResultGroup = {
  titulo: string;
  itens: ResultItem[];
};

const VAZIO: BuscaGlobalResultado = { candidatos: [], vagas: [], empresas: [], oportunidades: [] };

export function CommandPalette({ papel }: { papel: Papel | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [resultado, setResultado] = useState<BuscaGlobalResultado>(VAZIO);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqIdRef = useRef(0);

  const abrirPaleta = useCallback(() => {
    setQuery("");
    setResultado(VAZIO);
    setActiveIndex(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        abrirPaleta();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [abrirPaleta]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const termoValido = query.trim().length >= 2;
  const resultadoExibido = termoValido ? resultado : VAZIO;

  useEffect(() => {
    const termo = query.trim();
    if (termo.length < 2) return;
    const reqId = ++reqIdRef.current;
    const timeout = setTimeout(() => {
      buscaGlobal(termo).then((res) => {
        if (reqIdRef.current === reqId) setResultado(res);
      });
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  const navGroup: ResultGroup = useMemo(() => {
    const termo = query.trim().toLowerCase();
    const itens = getVisibleNavGroups(papel)
      .flatMap((g) => g.items)
      .filter((item) => !termo || item.label.toLowerCase().includes(termo))
      .map((item) => ({ key: `nav-${item.href}`, href: item.href, label: item.label, icon: item.icon }));
    return { titulo: "Navegar para", itens };
  }, [papel, query]);

  const gruposDinamicos: ResultGroup[] = useMemo(() => {
    const grupos: ResultGroup[] = [];
    if (resultadoExibido.candidatos.length > 0) {
      grupos.push({
        titulo: "Candidatos",
        itens: resultadoExibido.candidatos.map((c) => ({
          key: `candidato-${c.id}`,
          href: `/candidatos/${c.id}`,
          label: c.nome,
          sublabel: c.cargoAtual ?? undefined,
          icon: UserRound,
        })),
      });
    }
    if (resultadoExibido.vagas.length > 0) {
      grupos.push({
        titulo: "Vagas",
        itens: resultadoExibido.vagas.map((v) => ({
          key: `vaga-${v.id}`,
          href: `/vagas/${v.id}`,
          label: v.confidencial ? `🔒 ${v.cargo}` : v.cargo,
          sublabel: v.empresaNome,
          icon: Briefcase,
        })),
      });
    }
    if (resultadoExibido.empresas.length > 0) {
      grupos.push({
        titulo: "Empresas",
        itens: resultadoExibido.empresas.map((e) => ({
          key: `empresa-${e.id}`,
          href: `/empresas/${e.id}`,
          label: e.nome,
          icon: Building2,
        })),
      });
    }
    if (resultadoExibido.oportunidades.length > 0) {
      grupos.push({
        titulo: "Oportunidades",
        itens: resultadoExibido.oportunidades.map((o) => ({
          key: `oportunidade-${o.id}`,
          href: `/crm/pipeline-comercial`,
          label: o.empresaNome,
          sublabel: o.vertical,
          icon: GitPullRequest,
        })),
      });
    }
    return grupos;
  }, [resultadoExibido]);

  const grupos = useMemo(() => [navGroup, ...gruposDinamicos].filter((g) => g.itens.length > 0), [navGroup, gruposDinamicos]);
  const flatItens = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);

  const navegar = useCallback(
    (item: ResultItem) => {
      router.push(item.href);
      setOpen(false);
    },
    [router],
  );

  function onKeyDownInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(flatItens.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItens[activeIndex];
      if (item) navegar(item);
    }
  }

  let indiceAcumulado = 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-muted-foreground"
        onClick={abrirPaleta}
      >
        <Search />
        Buscar...
        <kbd className="ml-2 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </Button>
      <DialogContent className="top-24 max-w-lg -translate-y-0 gap-0 p-0 sm:max-w-lg" showCloseButton={false}>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDownInput}
            placeholder="Buscar candidatos, vagas, empresas, oportunidades ou navegar..."
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {flatItens.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhum resultado.</p>
          )}
          {grupos.map((grupo) => (
            <div key={grupo.titulo} className="mb-1">
              <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {grupo.titulo}
              </p>
              {grupo.itens.map((item) => {
                const indice = indiceAcumulado++;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navegar(item)}
                    onMouseEnter={() => setActiveIndex(indice)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm",
                      indice === activeIndex ? "bg-muted" : "hover:bg-muted/50",
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.sublabel && <span className="shrink-0 text-xs text-muted-foreground">{item.sublabel}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
