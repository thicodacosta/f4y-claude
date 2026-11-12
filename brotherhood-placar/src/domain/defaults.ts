import type { MatchRules, Team } from './types';

/** Regras oficiais de voleibol de quadra. */
export const DEFAULT_RULES: MatchRules = {
  bestOf: 5,
  setPoints: 25,
  tieBreakPoints: 15,
  minLead: 2,
  timeoutsPerSet: 2,
  timeoutDurationSec: 30,
  intervalDurationSec: 180,
};

export const DEFAULT_TEAMS: { A: Team; B: Team } = {
  A: { name: 'Brotherhood', color: '#E8B931', logo: '/brand/logo.jpg' },
  B: { name: 'Visitante', color: '#3B9EFF' },
};

export const TEAM_COLOR_PRESETS = [
  '#E8B931', // ouro
  '#3B9EFF', // azul
  '#E5484D', // vermelho
  '#30A46C', // verde
  '#8E4EC6', // roxo
  '#F76B15', // laranja
  '#12A594', // turquesa
  '#D6409F', // magenta
  '#C2C8D6', // prata
];
