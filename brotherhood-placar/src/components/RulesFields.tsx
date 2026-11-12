import { DEFAULT_RULES } from '../domain/defaults';
import type { MatchRules } from '../domain/types';
import { Field, Segmented } from './layout';

function NumberInput({
  id,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="field pr-12 tabular-nums"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-dim">{suffix}</span>}
    </div>
  );
}

export function RulesFields({ value, onChange }: { value: MatchRules; onChange: (r: MatchRules) => void }) {
  const set = <K extends keyof MatchRules>(k: K, v: MatchRules[K]) => onChange({ ...value, [k]: v });
  const isDefault = JSON.stringify(value) === JSON.stringify(DEFAULT_RULES);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Formato">
          <Segmented
            label="Formato da partida"
            value={value.bestOf}
            onChange={(v) => set('bestOf', v)}
            options={[
              { value: 3, label: 'Melhor de 3' },
              { value: 5, label: 'Melhor de 5' },
            ]}
          />
        </Field>
      </div>
      <Field label="Pontos por set" htmlFor="r-set">
        <NumberInput id="r-set" value={value.setPoints} min={5} max={99} onChange={(n) => set('setPoints', n)} suffix="pts" />
      </Field>
      <Field label="Pontos do tie-break" htmlFor="r-tb" hint={`Set ${value.bestOf}, se necessário`}>
        <NumberInput id="r-tb" value={value.tieBreakPoints} min={5} max={99} onChange={(n) => set('tieBreakPoints', n)} suffix="pts" />
      </Field>
      <Field label="Diferença mínima" htmlFor="r-lead">
        <NumberInput id="r-lead" value={value.minLead} min={1} max={5} onChange={(n) => set('minLead', n)} suffix="pts" />
      </Field>
      <Field label="Tempos técnicos por set" htmlFor="r-to">
        <NumberInput id="r-to" value={value.timeoutsPerSet} min={0} max={5} onChange={(n) => set('timeoutsPerSet', n)} suffix="/time" />
      </Field>
      <Field label="Duração do tempo técnico" htmlFor="r-tod">
        <NumberInput id="r-tod" value={value.timeoutDurationSec} min={10} max={300} onChange={(n) => set('timeoutDurationSec', n)} suffix="seg" />
      </Field>
      <Field label="Intervalo entre sets" htmlFor="r-int" hint="0 = próximo set começa direto">
        <NumberInput id="r-int" value={value.intervalDurationSec} min={0} max={900} onChange={(n) => set('intervalDurationSec', n)} suffix="seg" />
      </Field>
      {!isDefault && (
        <div className="sm:col-span-2">
          <button type="button" className="text-sm font-semibold text-gold hover:underline" onClick={() => onChange({ ...DEFAULT_RULES })}>
            Restaurar regras oficiais
          </button>
        </div>
      )}
    </div>
  );
}
