export type HeatmapCelula = { usuarioId: string; usuarioNome: string; dia: string; total: number };

/** Heatmap dia x pessoa — escala sequencial de matiz única (chart-1), do
 * claro pro escuro conforme a skill dataviz: nunca arco-íris pra magnitude.
 * Cada célula tem `title` com o valor exato (fallback textual/acessível já
 * que não há como colocar um rótulo em cada célula sem poluir a grade). */
export function HeatmapAtividade({ celulas, ano, mes }: { celulas: HeatmapCelula[]; ano: number; mes: number }) {
  const usuarios = Array.from(new Map(celulas.map((c) => [c.usuarioId, c.usuarioNome])).entries());
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);
  const maxTotal = Math.max(1, ...celulas.map((c) => c.total));

  const porUsuarioDia = new Map(celulas.map((c) => [`${c.usuarioId}:${c.dia.slice(8, 10)}`, c.total]));

  if (usuarios.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma atividade registrada neste mês ainda.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-[2px]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card pr-2 text-left text-xs font-normal text-muted-foreground">
              Pessoa
            </th>
            {dias.map((d) => (
              <th key={d} className="w-4 text-center text-[9px] font-normal text-muted-foreground">
                {d}
              </th>
            ))}
            <th className="pl-2 text-left text-xs font-normal text-muted-foreground">Total</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map(([usuarioId, nome]) => {
            const totalUsuario = dias.reduce(
              (acc, d) => acc + (porUsuarioDia.get(`${usuarioId}:${String(d).padStart(2, "0")}`) ?? 0),
              0,
            );
            return (
              <tr key={usuarioId}>
                <td className="sticky left-0 whitespace-nowrap bg-card pr-2 text-xs">{nome}</td>
                {dias.map((d) => {
                  const total = porUsuarioDia.get(`${usuarioId}:${String(d).padStart(2, "0")}`) ?? 0;
                  const opacidade = total === 0 ? 0.06 : 0.15 + 0.85 * (total / maxTotal);
                  return (
                    <td key={d} title={`${nome} — dia ${d}: ${total} atividade(s)`}>
                      <div
                        className="size-4 rounded-[4px]"
                        style={{ backgroundColor: `color-mix(in oklab, var(--color-chart-1) ${opacidade * 100}%, transparent)` }}
                      />
                    </td>
                  );
                })}
                <td className="pl-2 text-xs tabular-nums text-muted-foreground">{totalUsuario}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
