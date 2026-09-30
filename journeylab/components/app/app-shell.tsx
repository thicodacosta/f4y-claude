"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Check,
  ChevronDown,
  Globe,
  House,
  LifeBuoy,
  LogOut,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  ShieldCheck,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { ICONE_MODULO } from "@/components/app/icones-modulo";
import { Logo, Simbolo } from "@/components/marca";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { sair, selecionarOrganizacao } from "@/lib/auth/actions";
import { encerrarSuporte } from "@/lib/plataforma/actions";
import { cn } from "@/lib/utils";


export type DadosShell = {
  usuario: { nome: string; email: string; superadmin: boolean };
  org: { id: string; nome: string };
  papel: string;
  organizacoes: { id: string; nome: string }[];
  modulos: { chave: string; nome: string }[];
  cadastro: boolean;
  configuracoes: boolean;
  suporte: { expiraEm: string } | null;
};

type ItemNav = { href: string; rotulo: string; icone: LucideIcon };
type Grupo = { titulo: string; itens: ItemNav[] };

export const COOKIE_MENU = "jl_menu_recolhido";

function montarGrupos(d: DadosShell): Grupo[] {
  const grupos: Grupo[] = [{ titulo: "", itens: [{ href: "/inicio", rotulo: "Início", icone: House }] }];
  if (d.modulos.length > 0) {
    grupos.push({
      titulo: "Produtos",
      // A Página de Carreiras faz parte do CRM: aparece logo abaixo dele, com a mesma permissão.
      itens: d.modulos.flatMap((m) => [
        { href: `/${m.chave}`, rotulo: m.nome, icone: ICONE_MODULO[m.chave] ?? Target },
        ...(m.chave === "crm" ? [{ href: "/pagina-carreiras", rotulo: "Página de Carreiras", icone: Globe }] : []),
      ]),
    });
  }
  const org: ItemNav[] = [];
  if (d.cadastro) {
    org.push({ href: "/pessoas", rotulo: "Pessoas", icone: UserRound });
    org.push({ href: "/equipes", rotulo: "Áreas e equipes", icone: Network });
  }
  if (d.configuracoes) org.push({ href: "/configuracoes", rotulo: "Configurações", icone: Settings2 });
  if (org.length) grupos.push({ titulo: "Organização", itens: org });
  if (d.usuario.superadmin) {
    grupos.push({ titulo: "JourneyLab", itens: [{ href: "/plataforma", rotulo: "Administração", icone: ShieldCheck }] });
  }
  return grupos;
}

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/** Menu lateral — expandido (ícone + rótulo) ou em trilho de ícones (padrão do kit). */
function Navegacao({ d, recolhido = false, aoNavegar }: { d: DadosShell; recolhido?: boolean; aoNavegar?: () => void }) {
  const pathname = usePathname();
  const ativo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className={cn("flex h-full flex-col gap-6 py-5 text-sidebar-foreground", recolhido ? "items-center px-3" : "px-4")}>
      {recolhido ? (
        <Link href="/inicio" onClick={aoNavegar} aria-label="JourneyLab — início" className="flex size-11 items-center justify-center rounded-md bg-white/6">
          <Simbolo className="size-7" />
        </Link>
      ) : (
        <div className="px-1.5">
          <Logo claro />
        </div>
      )}

      <nav aria-label="Navegação principal" className="flex w-full flex-1 flex-col gap-5 overflow-y-auto">
        {montarGrupos(d).map((g) => (
          <div key={g.titulo || "inicio"} className="flex flex-col gap-1">
            {g.titulo &&
              (recolhido ? (
                <span className="mx-auto mb-1 h-px w-6 bg-sidebar-border" aria-hidden />
              ) : (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/55">{g.titulo}</p>
              ))}
            <ul className="flex flex-col gap-1">
              {g.itens.map((i) => {
                const atual = ativo(i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={aoNavegar}
                      aria-current={atual ? "page" : undefined}
                      title={recolhido ? i.rotulo : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-md text-[13.5px] font-medium text-sidebar-foreground/80 transition-colors outline-none hover:bg-white/6 hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        recolhido ? "size-11 justify-center" : "px-3 py-2.5",
                        atual && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {atual && !recolhido && <span className="absolute top-2 bottom-2 -left-4 w-1 rounded-r-full bg-teal" aria-hidden />}
                      <i.icone className="size-[18px] shrink-0" aria-hidden />
                      <span className={recolhido ? "sr-only" : "truncate"}>{i.rotulo}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <form action={sair} className="w-full">
        <button
          type="submit"
          title={recolhido ? "Sair" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md text-[13.5px] text-sidebar-foreground/70 hover:bg-white/6 hover:text-white",
            recolhido ? "mx-auto size-11 justify-center" : "w-full px-3 py-2.5",
          )}
        >
          <LogOut className="size-[18px]" aria-hidden />
          <span className={recolhido ? "sr-only" : ""}>Sair</span>
        </button>
      </form>
    </div>
  );
}

/** Popover simples baseado em <details>: funciona sem JS e fecha ao clicar fora/Esc. */
function Suspenso({ rotulo, botao, children, className }: { rotulo: string; botao: React.ReactNode; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const fechar = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", fechar);
    document.addEventListener("keydown", fechar);
    return () => {
      document.removeEventListener("pointerdown", fechar);
      document.removeEventListener("keydown", fechar);
    };
  }, []);
  return (
    <details ref={ref} className={cn("relative", className)}>
      <summary
        aria-label={rotulo}
        className="flex cursor-pointer list-none items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
      >
        {botao}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-hover">{children}</div>
    </details>
  );
}

function TrocaOrganizacao({ d }: { d: DadosShell }) {
  const botao = (
    <span className="flex h-10 max-w-[15rem] items-center gap-2 rounded-md border border-border bg-card px-3 text-sm hover:bg-muted">
      <Building2 className="size-4 shrink-0 text-teal-strong" aria-hidden />
      <span className="hidden truncate font-semibold sm:inline">{d.org.nome}</span>
      {d.organizacoes.length > 1 && <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </span>
  );
  if (d.organizacoes.length <= 1) return <div className="hidden sm:block">{botao}</div>;
  return (
    <Suspenso rotulo="Trocar organização" botao={botao}>
      <div data-trocar-org>
        <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Organizações</p>
        <ul>
          {d.organizacoes.map((o) => (
            <li key={o.id}>
              {o.id === d.org.id ? (
                <span className="flex items-center justify-between gap-2 rounded-md bg-teal-soft px-2.5 py-2 text-sm font-semibold text-teal-strong">
                  <span className="truncate">{o.nome}</span> <Check className="size-4 shrink-0" aria-label="Atual" />
                </span>
              ) : (
                <form action={selecionarOrganizacao.bind(null, o.id)}>
                  <button type="submit" className="w-full truncate rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted">
                    {o.nome}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Suspenso>
  );
}

function MenuUsuario({ d }: { d: DadosShell }) {
  return (
    <Suspenso
      rotulo="Menu da conta"
      botao={
        <span className="flex items-center gap-2.5 rounded-md py-1 pr-1 pl-1 hover:bg-muted sm:pr-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-teal dark:text-primary-foreground" aria-hidden>
            {iniciais(d.usuario.nome)}
          </span>
          <span className="hidden min-w-0 text-left md:block">
            <span className="block max-w-[10rem] truncate text-[13px] font-semibold leading-tight">{d.usuario.nome}</span>
            <span className="block max-w-[10rem] truncate text-xs leading-tight text-muted-foreground">{d.papel}</span>
          </span>
          <ChevronDown className="hidden size-4 text-muted-foreground md:block" aria-hidden />
        </span>
      }
    >
      <div className="border-b border-border px-2.5 pt-1.5 pb-2.5">
        <p className="truncate text-sm font-semibold">{d.usuario.nome}</p>
        <p className="truncate text-xs text-muted-foreground">{d.usuario.email}</p>
      </div>
      <Link href="/conta" className="mt-1 flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted">
        <UserRound className="size-4 text-muted-foreground" aria-hidden /> Minha conta
      </Link>
      <form action={sair}>
        <button type="submit" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted">
          <LogOut className="size-4 text-muted-foreground" aria-hidden /> Sair
        </button>
      </form>
    </Suspenso>
  );
}

/** Nome da seção atual para a barra superior (como o título da topbar do kit). */
function tituloSecao(pathname: string, d: DadosShell) {
  const raiz = pathname.split("/")[1] ?? "";
  for (const g of montarGrupos(d)) for (const i of g.itens) if (i.href === `/${raiz}`) return i.rotulo;
  if (raiz === "conta") return "Minha conta";
  return "";
}

export function AppShell({ dados, recolhidoInicial = false, children }: { dados: DadosShell; recolhidoInicial?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [recolhido, setRecolhido] = useState(recolhidoInicial);

  // Preferência em cookie para o servidor já renderizar o menu no estado certo (sem "piscar").
  function alternar() {
    const novo = !recolhido;
    setRecolhido(novo);
    document.cookie = `${COOKIE_MENU}=${novo ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="flex min-h-dvh flex-1">
      <div className={cn("hidden shrink-0 bg-sidebar transition-[width] duration-200 lg:block", recolhido ? "w-[76px]" : "w-64")}>
        <aside className="sticky top-0 h-dvh">
          <Navegacao d={dados} recolhido={recolhido} />
        </aside>
      </div>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="left" className="w-72 border-0 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <Navegacao d={dados} aoNavegar={() => setAberto(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {dados.suporte && (
          <div role="status" className="flex flex-wrap items-center justify-center gap-3 bg-warning px-4 py-2 text-center text-sm text-warning-foreground">
            <LifeBuoy className="size-4" aria-hidden />
            Acesso de suporte a <strong>{dados.org.nome}</strong> — somente leitura, até{" "}
            {new Date(dados.suporte.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
            <form action={encerrarSuporte}>
              <button type="submit" className="rounded border border-warning-foreground/40 px-2 py-0.5 text-xs font-semibold hover:bg-white/30">
                Encerrar suporte
              </button>
            </form>
          </div>
        )}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-label="Abrir menu"
            className="flex size-10 items-center justify-center rounded-md border border-border hover:bg-muted lg:hidden"
          >
            <Menu className="size-[18px]" aria-hidden />
          </button>
          <button
            type="button"
            onClick={alternar}
            aria-label={recolhido ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-pressed={recolhido}
            className="hidden size-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground lg:flex"
          >
            {recolhido ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}
          </button>
          <nav aria-label="Você está em" className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            <span className="hidden sm:inline">{dados.org.nome}</span>
            {tituloSecao(pathname, dados) && (
              <>
                <span className="mx-2 hidden text-border sm:inline" aria-hidden>/</span>
                <span className="font-semibold text-foreground">{tituloSecao(pathname, dados)}</span>
              </>
            )}
          </nav>
          <TrocaOrganizacao d={dados} />
          <ThemeToggle />
          <MenuUsuario d={dados} />
        </header>
        <main id="conteudo" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
