import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CalendarDays, Lock } from "lucide-react";
import { exigirContexto, pode } from "@/lib/contexto";
import { MODULOS, NOME_MODULO, type Modulo } from "@/lib/permissoes";
import { montarIndicadores, montarPendencias } from "@/lib/painel";
import { EstadoVazio } from "@/components/app/lista";
import { ICONE_MODULO } from "@/components/app/icones-modulo";
import { CabecalhoCartao, Cartao, CartaoKpi, ChipIcone, ItemAtividade, LinkVerTudo } from "@/components/app/painel";
import { Simbolo } from "@/components/marca";

export const metadata: Metadata = { title: "Início" };

export default async function InicioPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await exigirContexto();
  const sp = await searchParams;
  // Pulse: quem só responde também acessa (a gestão exige permissão dentro do módulo).
  const acessiveis = MODULOS.filter((m) => ctx.modulos.has(m.chave) && (pode(ctx, m.chave, "visualizar") || m.chave === "pulse"));
  const naoContratados = MODULOS.filter((m) => !ctx.modulos.has(m.chave));
  const [pendencias, indicadores] = await Promise.all([montarPendencias(ctx), montarIndicadores(ctx)]);
  const aviso = sp.bloqueado
    ? `O módulo ${NOME_MODULO[sp.bloqueado as Modulo] ?? ""} não está ativo para ${ctx.org.nome}.`
    : sp.sem_permissao
      ? `Seu papel não tem acesso a ${NOME_MODULO[sp.sem_permissao as Modulo] ?? "este módulo"}.`
      : null;
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const mostrarOutros = naoContratados.length > 0 && !ctx.suporte;
  // Muitos indicadores (vários produtos): boas-vindas em faixa e KPIs em 4 colunas.
  const faixa = indicadores.length > 4;

  return (
    <>
      {aviso && (
        <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          {aviso}
        </p>
      )}

      <div className={faixa ? "grid gap-4" : "grid gap-4 xl:grid-cols-[minmax(0,340px)_1fr]"}>
        <section
          className={`relative flex overflow-hidden rounded-lg bg-primary p-6 text-white shadow-surface dark:bg-card dark:text-foreground ${
            faixa ? "flex-col gap-5 md:flex-row md:items-center md:justify-between" : "flex-col justify-between gap-6"
          }`}
        >
          <span className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-teal/20 blur-2xl" aria-hidden />
          <div className={`relative flex gap-4 ${faixa ? "items-center" : "flex-col"}`}>
            <Simbolo className="size-12 ring-1 ring-white/15" />
            <div>
              <p className="text-sm text-white/70 dark:text-muted-foreground">Bem-vindo(a) de volta,</p>
              <h1 className="font-heading text-[26px] leading-tight font-bold tracking-tight">Olá, {ctx.usuario.nome.split(" ")[0]}</h1>
            </div>
          </div>
          <dl
            className={`relative grid gap-3 text-sm ${
              faixa ? "grid-cols-2 border-t border-white/10 pt-4 md:grid-cols-[auto_auto_auto] md:gap-x-10 md:border-0 md:pt-0 dark:border-border" : "grid-cols-2 border-t border-white/10 pt-4 dark:border-border"
            }`}
          >
            <div className="min-w-0">
              <dt className="text-xs text-white/60 dark:text-muted-foreground">Organização</dt>
              <dd className="truncate font-semibold">{ctx.org.nome}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-white/60 dark:text-muted-foreground">Seu papel</dt>
              <dd className="truncate font-semibold">{ctx.papel.nome}</dd>
            </div>
            <div className={`flex items-center gap-2 text-xs text-white/70 dark:text-muted-foreground ${faixa ? "col-span-2 md:col-span-1" : "col-span-2"}`}>
              <CalendarDays className="size-3.5 text-teal" aria-hidden />
              <span className="first-letter:uppercase">{hoje}</span>
            </div>
          </dl>
        </section>

        {indicadores.length > 0 ? (
          <section aria-label="Indicadores" className={`grid grid-cols-2 gap-3 sm:gap-4 ${faixa ? "lg:grid-cols-4" : ""}`}>
            {indicadores.map((i) => (
              <CartaoKpi key={i.rotulo} {...i} icone={ICONE_MODULO[i.modulo]} />
            ))}
          </section>
        ) : (
          <Cartao className="justify-center p-6">
            <p className="font-heading text-lg font-bold">Seu espaço no JourneyLab</p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Aqui aparecem os indicadores e as pendências dos produtos que você usa. Abra um produto abaixo para começar.
            </p>
          </Cartao>
        )}
      </div>

      <section aria-labelledby="modulos" className="flex flex-col gap-3">
        <h2 id="modulos" className="font-heading text-lg font-bold">
          Seus produtos
        </h2>
        {acessiveis.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum produto disponível para você"
            descricao="Sua organização ainda não ativou produtos ou seu papel não tem acesso a eles. Fale com o administrador da organização."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {acessiveis.map((m) => {
              const e = ctx.entitlements.find((x) => x.modulo === m.chave);
              return (
                <li key={m.chave}>
                  <Link
                    href={`/${m.chave}`}
                    className="group flex h-full items-start gap-4 rounded-lg border border-border bg-card p-5 shadow-surface transition-shadow outline-none hover:shadow-hover focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <ChipIcone icone={ICONE_MODULO[m.chave]} tom="navy" className="size-11" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <span className="font-heading text-[15px] font-bold">{m.nome}</span>
                        {e?.status === "teste" && <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-medium text-teal-strong">Em teste</span>}
                      </span>
                      <span className="text-[13px] leading-relaxed text-muted-foreground">{m.resumo}</span>
                    </span>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-teal-strong" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(pendencias.length > 0 || mostrarOutros) && (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {pendencias.length > 0 && (
            <h2 className="sr-only" id="pendencias">
              Para você acompanhar
            </h2>
          )}
          {pendencias.map((p) => (
            <Cartao key={p.titulo} aria-label={p.titulo}>
              <CabecalhoCartao titulo={p.titulo} descricao={p.resumo} acao={<LinkVerTudo href={p.href} />} />
              <div className="px-3 pb-3">
                {p.itens.length === 0 ? (
                  <p className="px-2 pb-3 text-sm text-muted-foreground">{p.vazio}</p>
                ) : (
                  <ul className="flex flex-col">
                    {p.itens.map((i) => (
                      <ItemAtividade
                        key={i.href + i.texto}
                        href={i.href}
                        icone={ICONE_MODULO[p.modulo]}
                        titulo={i.texto}
                        subtitulo={i.subtitulo}
                        valor={i.detalhe}
                        alerta={i.alerta}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </Cartao>
          ))}

          {mostrarOutros && (
            <Cartao aria-labelledby="outros" className="bg-brand-gradient-soft">
              <CabecalhoCartao id="outros" titulo="Conhecer outros produtos" descricao="Disponíveis para contratação pela sua organização." />
              <ul className="flex flex-col px-3">
                {naoContratados.map((m) => (
                  <li key={m.chave} className="flex items-center gap-3 px-2 py-2.5">
                    <ChipIcone icone={ICONE_MODULO[m.chave]} tom="neutro" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{m.nome}</span>
                      <span className="block truncate text-xs text-muted-foreground">{m.resumo}</span>
                    </span>
                    <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Não contratado" />
                  </li>
                ))}
              </ul>
              <p className="px-5 pt-1 pb-5 text-xs text-muted-foreground">Para contratar, fale com o administrador da sua organização ou com o JourneyLab.</p>
            </Cartao>
          )}
        </div>
      )}
    </>
  );
}
