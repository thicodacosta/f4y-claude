import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Star } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { valorPermitido, uuidOuNada } from "@/lib/validacao";
import { carregarRiscos, categoriaDominante, NIVEL_RISCO } from "@/lib/retencao-talentos/risco";
import { BarraBusca, EstadoVazio, FiltroSelect, Iniciais, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";

export const metadata: Metadata = { title: "Risco de saída — Retenção" };

const meses = (m: number) => (m >= 12 ? `${Math.floor(m / 12)}a ${m % 12}m` : `${m}m`);

/**
 * Risco de saída por pessoa (RH: organização; gestor: liderados diretos). Os
 * fatores aparecem por escrito — a pontuação é indicativa e serve para priorizar
 * conversas e ações, nunca para decisões automatizadas sobre a pessoa.
 */
export default async function RiscoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("retencao");
  const sp = await searchParams;
  const nivel = valorPermitido(sp.nivel, NIVEL_RISCO);
  const areaId = uuidOuNada(sp.area);
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 80);
  const todos = await carregarRiscos(ctx, escopo);
  const lista = todos.filter((r) => (!nivel || r.nivel === nivel) && (!areaId || r.areaId === areaId) && (!q || r.nome.toLowerCase().includes(q) || (r.cargo ?? "").toLowerCase().includes(q)) && (sp.talento !== "1" || r.talentoChave));
  const areas = escopo === "todos" ? await db.area.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : [];
  const podeCriar = !!pode(ctx, "retencao", "criar") && !ctx.suporte;
  const c = { alto: todos.filter((r) => r.nivel === "alto").length, medio: todos.filter((r) => r.nivel === "medio").length, baixo: todos.filter((r) => r.nivel === "baixo").length };

  return (
    <>
      <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-surface">
        <strong className="text-foreground">Como ler:</strong> a pontuação soma sinais dos módulos (feedback, PDI, onboarding, tempo de casa, liderança e área) que o seu papel pode ver. É{" "}
        <strong className="text-foreground">indicativa</strong>: use-a para priorizar conversas de permanência e ações — nunca como decisão automática sobre a pessoa.
        {escopo !== "todos" && " Você vê apenas seus liderados diretos."}
      </p>
      <BarraBusca q={sp.q} placeholder="Nome ou cargo">
        <FiltroSelect nome="nivel" rotulo="Nível" valor={nivel} opcoes={Object.entries(NIVEL_RISCO).map(([valor, n]) => ({ valor, rotulo: `${n.nome} (${c[valor as keyof typeof c]})` }))} />
        {areas.length > 0 && <FiltroSelect nome="area" rotulo="Área" valor={areaId} opcoes={areas.map((a) => ({ valor: a.id, rotulo: a.nome }))} />}
        <FiltroSelect nome="talento" rotulo="Talento-chave" valor={sp.talento} opcoes={[{ valor: "1", rotulo: "Só talentos-chave" }]} />
      </BarraBusca>
      {lista.length === 0 ? (
        <EstadoVazio titulo={todos.length ? "Ninguém com esses filtros" : "Nenhuma pessoa ativa no seu escopo"} descricao={todos.length ? "Ajuste os filtros." : "O risco é calculado para pessoas ativas visíveis ao seu papel."} />
      ) : (
        <Tabela colunas={["Pessoa", "Equipe e gestor", "Tempo de casa", "Risco", "Fatores", "Ações"]} minWidth={1040}>
          {lista.map((r) => (
            <tr key={r.id} data-risco={r.nivel}>
              <Celula>
                <span className="flex items-center gap-3">
                  <Iniciais nome={r.nome} />
                  <span className="min-w-0">
                    <Link href={`/colaboradores/${r.id}`} className="font-medium hover:text-teal-strong">
                      {r.nome}
                    </Link>
                    {r.talentoChave && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-teal-soft px-1.5 py-0.5 align-middle text-[11px] font-medium text-teal-strong">
                        <Star className="size-3" aria-hidden /> Talento-chave
                      </span>
                    )}
                    <span className="block text-xs text-muted-foreground">{r.cargo ?? "—"}</span>
                  </span>
                </span>
              </Celula>
              <Celula className="text-muted-foreground">
                {r.equipe ?? "—"}
                <span className="block text-xs">{r.gestor ? `Gestor: ${r.gestor}` : "Sem gestor"}</span>
              </Celula>
              <Celula className="tabular-nums text-muted-foreground">{meses(r.tempoCasaMeses)}</Celula>
              <Celula>
                <span className="flex flex-col gap-1.5">
                  <Selo tom={NIVEL_RISCO[r.nivel].tom}>{NIVEL_RISCO[r.nivel].nome}</Selo>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className="block h-full rounded-full" style={{ width: `${r.pontos}%`, background: r.nivel === "alto" ? "var(--destructive)" : r.nivel === "medio" ? "var(--warning)" : "var(--success)" }} />
                    </span>
                    <span className="text-xs tabular-nums">{r.pontos} pts</span>
                  </span>
                </span>
              </Celula>
              <Celula>
                {r.fatores.length ? (
                  <ul className="flex flex-col gap-0.5 text-xs">
                    {r.fatores.map((x) => (
                      <li key={x.texto}>
                        <span className="tabular-nums text-muted-foreground">+{x.pontos}</span> {x.texto}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-xs text-muted-foreground">Nenhum sinal de risco</span>
                )}
              </Celula>
              <Celula>
                <span className="flex flex-col items-start gap-1.5">
                  {r.acoesAbertas > 0 && (
                    <Link href={`/retencao/acoes?pessoa=${r.id}`} className="text-xs font-medium text-teal-strong hover:underline">
                      {r.acoesAbertas} ação(ões) em aberto
                    </Link>
                  )}
                  {podeCriar && r.nivel !== "baixo" && (
                    <Link
                      href={`/retencao/acoes?nova=1&colaborador=${r.id}&categoria=${categoriaDominante(r)}&origem=risco#nova-acao`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted"
                    >
                      <Plus className="size-3.5" aria-hidden /> Criar ação
                    </Link>
                  )}
                </span>
              </Celula>
            </tr>
          ))}
        </Tabela>
      )}
      <p className="text-sm text-muted-foreground">{lista.length} pessoa(s)</p>
    </>
  );
}
