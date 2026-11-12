import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDuration } from '../domain/clock';
import type { MatchState, TeamId } from '../domain/types';
import { Button, Dialog, TeamLogo } from './ui';

function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-panel-2 disabled:opacity-30"
        onClick={() => onChange(value - 1)}
        disabled={value <= 0}
        aria-label={`Diminuir ${label}`}
      >
        <Minus size={18} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={value}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n)) onChange(Math.max(0, Math.min(99, n)));
        }}
        className="score-digits h-14 w-20 rounded-xl border border-line bg-panel-2 text-center text-4xl"
        aria-label={label}
      />
      <button
        type="button"
        className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-panel-2"
        onClick={() => onChange(Math.min(99, value + 1))}
        aria-label={`Aumentar ${label}`}
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

export function CorrectScoreDialog({
  open,
  match,
  onClose,
  onApply,
}: {
  open: boolean;
  match: MatchState;
  onClose: () => void;
  onApply: (a: number, b: number) => void;
}) {
  const [a, setA] = useState(match.score.A);
  const [b, setB] = useState(match.score.B);
  useEffect(() => {
    if (open) {
      setA(match.score.A);
      setB(match.score.B);
    }
  }, [open, match.score.A, match.score.B]);

  const changed = a !== match.score.A || b !== match.score.B;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Corrigir placar · Set ${match.currentSet}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!changed} onClick={() => onApply(a, b)}>
            Aplicar correção
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {(['A', 'B'] as TeamId[]).map((t) => (
          <div key={t} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <TeamLogo team={match.teams[t]} size={32} />
              <span className="truncate font-semibold">{match.teams[t].name}</span>
            </span>
            <Stepper value={t === 'A' ? a : b} onChange={t === 'A' ? setA : setB} label={`pontos de ${match.teams[t].name}`} />
          </div>
        ))}
        <p className="text-sm text-muted">
          A correção fica registrada no histórico. Se o novo placar fechar o set, ele será encerrado. O saque não muda — ajuste
          manualmente se precisar.
        </p>
      </div>
    </Dialog>
  );
}

export function NotesDialog({
  open,
  match,
  onClose,
  onAdd,
}: {
  open: boolean;
  match: MatchState;
  onClose: () => void;
  onAdd: (text: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <Dialog open={open} onClose={onClose} title="Observações" wide>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onAdd(text);
          setText('');
        }}
      >
        <label htmlFor="note-text" className="sr-only">
          Nova observação
        </label>
        <textarea
          id="note-text"
          className="field min-h-24 resize-y"
          placeholder="Ex.: troca de bola, atraso no início, cartão amarelo nº 7…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={280}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <Button type="submit" variant="primary" disabled={!text.trim()}>
            Registrar
          </Button>
        </div>
      </form>
      {match.notes.length > 0 && (
        <ul className="mt-4 max-h-60 space-y-2 overflow-auto border-t border-line pt-4">
          {[...match.notes].reverse().map((n, i) => (
            <li key={i} className="rounded-xl bg-panel-2 px-3 py-2 text-sm">
              <span className="mr-2 font-display font-semibold text-gold tabular-nums">
                Set {n.set} · {formatDuration(n.matchTimeMs)}
              </span>
              {n.text}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
