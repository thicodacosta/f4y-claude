import { FileDown, ImageDown, Loader2, Share2, Trash, Trophy } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useConfirm } from '../components/confirm';
import { PageShell, Section, Toggle } from '../components/layout';
import { CARD_H, CARD_W, ResultCard } from '../components/ResultCard';
import { Button, LinkButton, StatusPill, TeamLogo } from '../components/ui';
import { formatDuration } from '../domain/clock';
import { totalPoints } from '../domain/selectors';
import type { MatchEvent, MatchState } from '../domain/types';
import { formatDate, formatTime } from '../lib/browser';
import { download, exportName, renderPng, savePdf, sharePng } from '../lib/export';
import { href, navigate } from '../lib/router';
import { store, useHistory, useMatch } from '../state/store';

export function MatchDetailScreen({ id }: { id: string }) {
  const history = useHistory();
  const current = useMatch();
  const m = history.find((x) => x.id === id) ?? (current?.id === id ? current : null);

  if (!m) {
    return (
      <PageShell title="Partida" back={href.history}>
        <p className="text-muted">Partida não encontrada neste dispositivo.</p>
      </PageShell>
    );
  }
  return <Detail m={m} />;
}

type TimelineItem = { at: number; set: number; time: number; text: string; tone: 'major' | 'minor' | 'note'; scoreA: number; scoreB: number };

function describe(e: MatchEvent, m: MatchState): Omit<TimelineItem, 'at' | 'set' | 'time' | 'scoreA' | 'scoreB'> | null {
  const team = e.team ? m.teams[e.team].name : '';
  switch (e.type) {
    case 'start':
      return { text: `Início da partida · saque de ${team}`, tone: 'major' };
    case 'set_start':
      return { text: `Início do set ${e.set}`, tone: 'major' };
    case 'set_end':
      return { text: `Set ${e.set} para ${team} (${e.scoreA}–${e.scoreB})${e.detail === 'manual' ? ' · encerrado manualmente' : ''}`, tone: 'major' };
    case 'match_end':
      return { text: e.team ? `Fim de jogo · vitória de ${team}${e.detail === 'manual' ? ' (encerrada manualmente)' : ''}` : 'Partida encerrada manualmente', tone: 'major' };
    case 'timeout':
      return { text: `Tempo técnico · ${team}`, tone: 'minor' };
    case 'pause':
      return { text: 'Partida pausada', tone: 'minor' };
    case 'resume':
      return { text: 'Partida retomada', tone: 'minor' };
    case 'score_corrected':
      return { text: `Placar corrigido: ${e.detail}`, tone: 'minor' };
    case 'serve_manual':
      return { text: `Saque alterado manualmente para ${team}`, tone: 'minor' };
    case 'point_removed':
      return { text: `Ponto removido de ${team}`, tone: 'minor' };
    case 'point':
      return { text: `Ponto ${team}`, tone: 'minor' };
    default:
      return null;
  }
}

function Detail({ m }: { m: MatchState }) {
  const confirm = useConfirm();
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'png' | 'pdf' | 'share' | null>(null);
  const [allPoints, setAllPoints] = useState(false);
  const [error, setError] = useState('');
  const totals = totalPoints(m);
  const colors = { A: m.teams.A.color, B: m.teams.B.color };
  const canShare = typeof navigator.canShare === 'function';

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    for (const e of m.events) {
      if (!allPoints && (e.type === 'point' || e.type === 'timeout_end' || e.type === 'serve_change')) continue;
      const d = describe(e, m);
      if (d) items.push({ ...d, at: e.at, set: e.set, time: e.matchTimeMs, scoreA: e.scoreA, scoreB: e.scoreB });
    }
    for (const n of m.notes) items.push({ at: n.at, set: n.set, time: n.matchTimeMs, text: n.text, tone: 'note', scoreA: NaN, scoreB: NaN });
    return items.sort((a, b) => a.at - b.at);
  }, [m, allPoints]);

  const run = async (kind: 'png' | 'pdf' | 'share') => {
    if (!cardRef.current) return;
    setBusy(kind);
    setError('');
    try {
      const png = await renderPng(cardRef.current);
      if (kind === 'png') download(png, exportName(m, 'png'));
      else if (kind === 'pdf') await savePdf(png, exportName(m, 'pdf'), CARD_W, CARD_H);
      else if (!(await sharePng(png, exportName(m, 'png'), `${m.teams.A.name} × ${m.teams.B.name}`))) download(png, exportName(m, 'png'));
    } catch {
      setError('Não foi possível gerar o arquivo. Tente novamente.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Excluir partida?',
      message: 'O resultado será removido do histórico deste dispositivo. Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      tone: 'danger',
    });
    if (!ok) return;
    store.deleteFromHistory(m.id);
    navigate(href.history);
  };

  return (
    <PageShell title="Resumo da partida" back={href.history}>
      <div className="flex flex-col gap-5">
        {/* Resultado */}
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
            <p className="eyebrow">
              {formatDate(m.info.date)}
              {m.info.tournament && ` · ${m.info.tournament}`}
              {m.info.venue && ` · ${m.info.venue}`}
            </p>
            <StatusPill status={m.status} />
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-8">
            {(['A', 'B'] as const).map((t, i) => (
              <div key={t} className={`flex flex-col items-center gap-3 text-center ${i === 1 ? 'col-start-3' : ''}`}>
                <TeamLogo team={m.teams[t]} size={64} />
                <p className="font-display text-xl font-bold uppercase sm:text-2xl" style={{ color: m.winner === t ? colors[t] : undefined }}>
                  {m.winner === t && <Trophy size={18} className="mr-1.5 inline -translate-y-0.5 text-gold" />}
                  {m.teams[t].name}
                </p>
                <p className="text-sm text-muted">{totals[t]} pontos no total</p>
              </div>
            ))}
            <p className="score-digits col-start-2 row-start-1 text-6xl sm:text-8xl">
              {m.setsWon.A}
              <span className="mx-2 text-dim">–</span>
              {m.setsWon.B}
            </p>
          </div>
        </section>

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => run('png')} disabled={!!busy}>
            {busy === 'png' ? <Loader2 size={18} className="animate-spin" /> : <ImageDown size={18} />} Exportar imagem
          </Button>
          <Button onClick={() => run('pdf')} disabled={!!busy}>
            {busy === 'pdf' ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />} Exportar PDF
          </Button>
          {canShare && (
            <Button onClick={() => run('share')} disabled={!!busy}>
              {busy === 'share' ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} Compartilhar
            </Button>
          )}
          {m.status !== 'finished' && (
            <LinkButton href={href.scoreboard} variant="ghost">
              Voltar ao placar
            </LinkButton>
          )}
          {m.status === 'finished' && (
            <Button variant="ghost" onClick={remove} className="ml-auto text-danger! hover:bg-danger/10!">
              <Trash size={18} /> Excluir
            </Button>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        {/* Sets */}
        <Section title="Sets">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left">
              <thead>
                <tr className="eyebrow border-b border-line">
                  <th className="py-2 pr-3 font-semibold">Set</th>
                  <th className="py-2 pr-3 font-semibold">{m.teams.A.name}</th>
                  <th className="py-2 pr-3 font-semibold">{m.teams.B.name}</th>
                  <th className="py-2 pr-3 font-semibold">Vencedor</th>
                  <th className="py-2 text-right font-semibold">Duração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {m.sets.map((s) => (
                  <tr key={s.number}>
                    <td className="py-3 pr-3 font-display text-lg font-bold">{s.number}</td>
                    <td className="py-3 pr-3 font-display text-2xl font-extrabold tabular-nums" style={{ color: s.winner === 'A' ? colors.A : undefined }}>
                      {s.scoreA}
                    </td>
                    <td className="py-3 pr-3 font-display text-2xl font-extrabold tabular-nums" style={{ color: s.winner === 'B' ? colors.B : undefined }}>
                      {s.scoreB}
                    </td>
                    <td className="py-3 pr-3">
                      {m.teams[s.winner].name}
                      {s.forced && <span className="ml-2 text-xs text-dim">(manual)</span>}
                    </td>
                    <td className="py-3 text-right text-muted tabular-nums">{formatDuration(s.durationMs)}</td>
                  </tr>
                ))}
                {m.sets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-muted">
                      Nenhum set concluído.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong">
                  <td className="py-3 pr-3 eyebrow" colSpan={4}>
                    Duração total
                  </td>
                  <td className="py-3 text-right font-display text-lg font-bold tabular-nums">{formatDuration(m.clock.elapsedMs)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>

        {/* Linha do tempo */}
        <Section title="Linha do tempo">
          <Toggle checked={allPoints} onChange={setAllPoints} label="Mostrar todos os pontos" />
          <ol className="mt-3 border-l border-line-strong pl-5">
            {timeline.map((it, i) => (
              <li key={i} className="relative py-2">
                <span
                  className={`absolute top-3.5 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-panel ${
                    it.tone === 'major' ? 'bg-gold' : it.tone === 'note' ? 'bg-sky-400' : 'bg-dim'
                  }`}
                />
                <p className={it.tone === 'major' ? 'font-semibold' : it.tone === 'note' ? 'text-sky-200' : 'text-muted'}>
                  {it.tone === 'note' && <span className="mr-1 font-semibold">Observação:</span>}
                  {it.text}
                </p>
                <p className="text-xs text-dim tabular-nums">
                  {formatTime(it.at)} · Set {it.set} · {formatDuration(it.time)}
                  {!Number.isNaN(it.scoreA) && it.tone !== 'major' && ` · ${it.scoreA}–${it.scoreB}`}
                </p>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      {/* Arte de exportação, fora da tela */}
      <div aria-hidden className="pointer-events-none fixed top-0 -left-[99999px]">
        <ResultCard ref={cardRef} m={m} />
      </div>
    </PageShell>
  );
}
